import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { stableJson } from "@/lib/sync/normalize";
import type { NormalizedIncomingRecord, SyncEntityType, SyncSummary } from "@/lib/sync/types";
import type { DataSource } from "@/types/campus-data";

import { getSourceAdapter } from "./adapters";

export { normalizeIncomingRecord } from "@/lib/sync/normalize";

const tableByType: Record<SyncEntityType, string> = {
  academic_program: "academic_programs",
  course: "courses",
  academic_term: "academic_terms",
  instructor: "instructors",
  course_section: "course_sections",
  organization: "organizations",
  campus_entity: "campus_entities",
};

type ExistingRecord = Record<string, unknown> & {
  id: string;
  external_id: string | null;
  effective_from?: string | null;
  source_fingerprint?: string | null;
};

export function compareExistingRecord(existing: Record<string, unknown> | null, incoming: NormalizedIncomingRecord) {
  if (!existing) return "create" as const;
  if (existing.source_fingerprint === incoming.fingerprint) return "unchanged" as const;
  const comparable = Object.fromEntries(Object.entries(existing)
    .filter(([key]) => !["created_at", "updated_at", "source_fingerprint"].includes(key)));
  const existingFingerprint = createHash("sha256").update(stableJson(comparable)).digest("hex");
  return existingFingerprint === incoming.fingerprint ? "unchanged" as const : "update" as const;
}

export function createUpdate(existing: Record<string, unknown>, incoming: NormalizedIncomingRecord) {
  return { previousValue: existing, nextValue: incoming.payload, changedAt: new Date().toISOString() };
}

export function archiveMissingRecord(existing: Record<string, unknown>) {
  return { ...existing, status: "archived", effective_until: new Date().toISOString().slice(0, 10) };
}

function provenanceRow(record: NormalizedIncomingRecord, source: DataSource) {
  const payload = record.payload;
  return {
    id: typeof payload.id === "string" ? payload.id : undefined,
    university_id: record.universityId,
    external_id: record.externalId,
    source_id: source.id,
    source_url: typeof payload.sourceUrl === "string" ? payload.sourceUrl : source.url,
    source_type: source.isDevelopment ? "development_seed" : "official_source",
    confidence_level: source.isDevelopment ? "pending" : "official",
    effective_from: typeof payload.effectiveFrom === "string" ? payload.effectiveFrom : new Date().toISOString().slice(0, 10),
    effective_until: typeof payload.effectiveUntil === "string" ? payload.effectiveUntil : null,
    last_verified_at: typeof payload.lastVerifiedAt === "string" ? payload.lastVerifiedAt : null,
    is_development: source.isDevelopment,
    source_fingerprint: record.fingerprint,
  };
}

function toDatabaseRow(record: NormalizedIncomingRecord, source: DataSource): Record<string, unknown> {
  const payload = record.payload;
  const provenance = provenanceRow(record, source);
  switch (record.entityType) {
    case "academic_program":
      return { ...provenance, name: payload.name, degree_type: payload.degreeType,
        department: payload.department, description: payload.description, status: payload.status };
    case "course":
      return { ...provenance, subject_code: payload.subjectCode, course_number: payload.courseNumber,
        title: payload.title, description: payload.description, credit_hours: payload.creditHours,
        department: payload.department, status: payload.status };
    case "academic_term":
      return { ...provenance, code: payload.code, name: payload.name, starts_on: payload.startsOn,
        ends_on: payload.endsOn, registration_status: payload.registrationStatus };
    case "instructor":
      return { ...provenance, display_name: payload.displayName, department: payload.department,
        title: payload.title, status: payload.status };
    case "course_section":
      return { ...provenance, course_id: payload.courseId, term_id: payload.termId,
        section_number: payload.sectionNumber, days: payload.days, start_time: payload.startTime,
        end_time: payload.endTime, location_text: payload.location, modality: payload.modality, status: payload.status };
    case "organization":
      return { ...provenance, campus_network_id: payload.campusNetworkId, name: payload.name,
        short_description: payload.shortDescription, full_description: payload.fullDescription,
        category: payload.category, logo_url: payload.logoUrl, photo_url: payload.photoUrl,
        official_status: payload.officialStatus, membership_type: payload.membershipType,
        website: payload.website, instagram: payload.instagram, contact_email: payload.contactEmail,
        meeting_location: payload.meetingLocation, meeting_schedule: payload.meetingSchedule,
        member_count: payload.memberCount, cross_campus: payload.crossCampus,
        keywords: payload.keywords, status: "active" };
    case "campus_entity":
      return { ...provenance, entity_type: payload.entityType, name: payload.name,
        description: payload.description, status: payload.status, address: payload.address,
        latitude: payload.latitude, longitude: payload.longitude, metadata: payload.metadata ?? {} };
  }
}

function archivedFields(entityType: SyncEntityType, existing: ExistingRecord) {
  const archived = archiveMissingRecord(existing);
  const base = { effective_until: archived.effective_until };
  if (entityType === "academic_term") return base;
  if (entityType === "campus_entity") return { ...base, status: "closed" };
  if (entityType === "organization") return { ...base, status: "archived" };
  if (entityType === "academic_program" || entityType === "course") return { ...base, status: "archived" };
  return { ...base, status: "archived" };
}

async function recordChange(
  client: ReturnType<typeof createSupabaseAdminClient>,
  source: DataSource,
  syncRunId: string,
  record: { entityType: string; entityId: string; changeType: string; previous: unknown; next: unknown },
) {
  const { error } = await client.from("data_change_events").insert({
    university_id: source.universityId,
    source_id: source.id,
    sync_run_id: syncRunId,
    entity_type: record.entityType,
    entity_id: record.entityId,
    change_type: record.changeType,
    previous_value: record.previous,
    next_value: record.next,
    meaningful: true,
  });
  if (error) throw error;
}

async function connectSectionInstructors(
  client: ReturnType<typeof createSupabaseAdminClient>,
  sectionId: string,
  record: NormalizedIncomingRecord,
) {
  const instructorIds = Array.isArray(record.payload.instructorIds)
    ? record.payload.instructorIds.filter((value): value is string => typeof value === "string") : [];
  if (!instructorIds.length) return;
  const { error } = await client.from("section_instructors").upsert(
    instructorIds.map((instructorId, index) => ({ section_id: sectionId, instructor_id: instructorId, is_primary: index === 0 })),
    { onConflict: "section_id,instructor_id" },
  );
  if (error) throw error;
}

export async function syncUniversitySource(source: DataSource): Promise<SyncSummary> {
  if (!source.enabled) throw new Error(`${source.name} is disabled.`);
  const adapter = getSourceAdapter(source.adapterKey);

  if (!hasSupabaseServerConfig()) {
    const records = await adapter.load(source);
    return {
      sourceId: source.id, mode: "dry-run", created: records.length, updated: 0, unchanged: 0, archived: 0,
      message: "Validated local adapter output. Configure server-only Supabase variables to persist.",
    };
  }

  const client = createSupabaseAdminClient();
  const { data: run, error: runError } = await client.from("data_sync_runs")
    .insert({ source_id: source.id, status: "running" }).select("id").single();
  if (runError) throw runError;

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let archived = 0;

  try {
    const records = await adapter.load(source);
    const incomingKeys = new Map<SyncEntityType, Set<string>>();
    for (const record of records) {
      const keys = incomingKeys.get(record.entityType) ?? new Set<string>();
      keys.add(record.externalId);
      incomingKeys.set(record.entityType, keys);

      const table = tableByType[record.entityType];
      const { data: existing, error: readError } = await client.from(table)
        .select("*").eq("university_id", record.universityId).eq("external_id", record.externalId)
        .is("effective_until", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (readError) throw readError;

      const current = existing as ExistingRecord | null;
      const action = compareExistingRecord(current, record);
      if (action === "unchanged") { unchanged += 1; continue; }

      const row = toDatabaseRow(record, source);
      let savedId: string;
      if (action === "create") {
        const { data: inserted, error } = await client.from(table).insert(row).select("id").single();
        if (error) throw error;
        savedId = inserted.id as string;
        created += 1;
        await recordChange(client, source, run.id, {
          entityType: record.entityType, entityId: savedId, changeType: "created", previous: null, next: row,
        });
      } else {
        if (!current) throw new Error(`Missing current ${record.entityType} record during update.`);
        const update = createUpdate(current, record);
        const today = new Date().toISOString().slice(0, 10);
        const shouldVersion = !source.isDevelopment && current.effective_from && current.effective_from !== today;
        if (shouldVersion) {
          const { error: closeError } = await client.from(table)
            .update(archivedFields(record.entityType, current)).eq("id", current.id);
          if (closeError) throw closeError;
          delete row.id;
          row.effective_from = today;
          const { data: inserted, error } = await client.from(table).insert(row).select("id").single();
          if (error) throw error;
          savedId = inserted.id as string;
        } else {
          const { data: changed, error } = await client.from(table).update(row).eq("id", current.id).select("id").single();
          if (error) throw error;
          savedId = changed.id as string;
        }
        updated += 1;
        await recordChange(client, source, run.id, {
          entityType: record.entityType, entityId: savedId, changeType: "updated",
          previous: update.previousValue, next: update.nextValue,
        });
      }

      if (record.entityType === "course_section") await connectSectionInstructors(client, savedId, record);
    }

    for (const [entityType, incoming] of incomingKeys) {
      const table = tableByType[entityType];
      const { data: existingRows, error } = await client.from(table).select("*")
        .eq("university_id", source.universityId).eq("source_id", source.id).is("effective_until", null);
      if (error) throw error;
      for (const existing of (existingRows ?? []) as ExistingRecord[]) {
        if (!existing.external_id || incoming.has(existing.external_id)) continue;
        const next = archivedFields(entityType, existing);
        const { error: archiveError } = await client.from(table).update(next).eq("id", existing.id);
        if (archiveError) throw archiveError;
        archived += 1;
        await recordChange(client, source, run.id, {
          entityType, entityId: existing.id, changeType: "archived", previous: existing, next,
        });
      }
    }

    const { error: finishError } = await client.from("data_sync_runs").update({
      status: "succeeded", finished_at: new Date().toISOString(), added_count: created,
      updated_count: updated, archived_count: archived,
      metadata: { unchanged_count: unchanged },
    }).eq("id", run.id);
    if (finishError) throw finishError;
    const { error: sourceError } = await client.from("data_sources")
      .update({ last_successful_sync: new Date().toISOString() }).eq("id", source.id);
    if (sourceError) throw sourceError;
    return { sourceId: source.id, mode: "persisted", created, updated, unchanged, archived, message: "Sync completed." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await client.from("data_sync_runs").update({
      status: "failed", finished_at: new Date().toISOString(), added_count: created,
      updated_count: updated, archived_count: archived, error_message: message,
    }).eq("id", run.id);
    throw error;
  }
}
