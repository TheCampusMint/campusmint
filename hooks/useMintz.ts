"use client";

import { useEffect, useMemo, useState } from "react";

import { createDevelopmentMintz } from "@/data/development/mintz";
import { resolveContentStatus } from "@/lib/content/expiration";
import {
  canCommentOnMint,
  canLikeMint,
  canViewMint,
  type MintPermissionContext,
} from "@/lib/social/mintPermissions";
import type {
  ContentReport,
  PendingContentNotification,
} from "@/types/content";
import type {
  CreateMintInput,
  Mint,
  MintComment,
  MintLike,
  MintSave,
  MintShare,
} from "@/types/mint";

function localId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export function useMintz() {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [storedMintz, setStoredMintz] = useState<Mint[]>(() => createDevelopmentMintz(currentTime));
  const [likes, setLikes] = useState<MintLike[]>([]);
  const [comments, setComments] = useState<MintComment[]>([]);
  const [saves, setSaves] = useState<MintSave[]>([]);
  const [shares, setShares] = useState<MintShare[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<PendingContentNotification[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const mintz = useMemo(() => storedMintz.map((mint) => ({
    ...mint,
    status: resolveContentStatus(mint.status, mint.expiresAt, currentTime),
  })), [currentTime, storedMintz]);

  function createMint(input: CreateMintInput) {
    const now = new Date().toISOString();
    const mint: Mint = {
      ...input,
      id: localId("mint"),
      createdAt: now,
      updatedAt: now,
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      archivedAt: null,
      status: "active",
    };
    setStoredMintz((current) => [mint, ...current]);
    const recipients = new Map<string, "mention" | "tag">();
    mint.mentions.forEach((mention) => recipients.set(mention.userId, "mention"));
    mint.taggedUserIds.forEach((userId) => recipients.set(userId, "tag"));
    setPendingNotifications((current) => [...current, ...Array.from(recipients, ([recipientId, reason]) => ({
      id: localId("notification"),
      recipientId,
      actorId: mint.authorId,
      contentType: "mint" as const,
      contentId: mint.id,
      reason,
      createdAt: now,
      deliveredAt: null,
    }))]);
    return mint;
  }

  function toggleLike(context: MintPermissionContext) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canLikeMint(context)) return false;
    const exists = likes.some((like) => like.mintId === context.mint.id && like.userId === viewerId);
    setLikes((current) => exists
      ? current.filter((like) => !(like.mintId === context.mint.id && like.userId === viewerId))
      : [...current, { id: localId("mint-like"), mintId: context.mint.id, userId: viewerId, createdAt: new Date().toISOString() }]);
    setStoredMintz((current) => current.map((mint) => mint.id === context.mint.id
      ? { ...mint, likeCount: Math.max(0, mint.likeCount + (exists ? -1 : 1)), updatedAt: new Date().toISOString() }
      : mint));
    return true;
  }

  function addComment(context: MintPermissionContext, body: string, mentions: MintComment["mentions"] = []) {
    const viewerId = context.viewer?.account.id;
    const trimmedBody = body.trim();
    if (!viewerId || !trimmedBody || !canCommentOnMint(context)) return false;
    const now = new Date().toISOString();
    setComments((current) => [...current, {
      id: localId("mint-comment"),
      targetType: "mint",
      targetId: context.mint.id,
      authorId: viewerId,
      body: trimmedBody,
      mentions,
      parentCommentId: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }]);
    setStoredMintz((current) => current.map((mint) => mint.id === context.mint.id
      ? { ...mint, commentCount: mint.commentCount + 1, updatedAt: now }
      : mint));
    return true;
  }

  function deleteOwnComment(commentId: string, userId: string) {
    const comment = comments.find((candidate) => candidate.id === commentId);
    if (!comment || comment.authorId !== userId || comment.status !== "active") return false;
    setComments((current) => current.map((candidate) => candidate.id === commentId
      ? { ...candidate, status: "deleted", body: "", updatedAt: new Date().toISOString() }
      : candidate));
    setStoredMintz((current) => current.map((mint) => mint.id === comment.targetId
      ? { ...mint, commentCount: Math.max(0, mint.commentCount - 1) }
      : mint));
    return true;
  }

  function toggleSave(context: MintPermissionContext) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canViewMint(context)) return false;
    const exists = saves.some((save) => save.mintId === context.mint.id && save.userId === viewerId);
    setSaves((current) => exists
      ? current.filter((save) => !(save.mintId === context.mint.id && save.userId === viewerId))
      : [...current, { id: localId("mint-save"), mintId: context.mint.id, userId: viewerId, createdAt: new Date().toISOString() }]);
    setStoredMintz((current) => current.map((mint) => mint.id === context.mint.id
      ? { ...mint, saveCount: Math.max(0, mint.saveCount + (exists ? -1 : 1)) }
      : mint));
    return true;
  }

  function recordShare(context: MintPermissionContext, channel: MintShare["channel"]) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canViewMint(context)) return false;
    setShares((current) => [...current, { id: localId("mint-share"), mintId: context.mint.id, userId: viewerId, channel, createdAt: new Date().toISOString() }]);
    setStoredMintz((current) => current.map((mint) => mint.id === context.mint.id ? { ...mint, shareCount: mint.shareCount + 1 } : mint));
    return true;
  }

  function updateOwnMint(mintId: string, userId: string, patch: Partial<Pick<Mint, "caption" | "likesVisible" | "commentsEnabled">>) {
    const mint = storedMintz.find((candidate) => candidate.id === mintId);
    if (!mint || mint.authorId !== userId || mint.status !== "active") return false;
    setStoredMintz((current) => current.map((candidate) => candidate.id === mintId
      ? { ...candidate, ...patch, updatedAt: new Date().toISOString() }
      : candidate));
    return true;
  }

  function toggleArchive(mintId: string, userId: string) {
    const mint = storedMintz.find((candidate) => candidate.id === mintId);
    if (!mint || mint.authorId !== userId) return false;
    setStoredMintz((current) => current.map((candidate) => candidate.id === mintId
      ? { ...candidate, archivedAt: candidate.archivedAt ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }
      : candidate));
    return true;
  }

  function deleteOwnMint(mintId: string, userId: string) {
    const mint = storedMintz.find((candidate) => candidate.id === mintId);
    if (!mint || mint.authorId !== userId) return false;
    setStoredMintz((current) => current.map((candidate) => candidate.id === mintId
      ? { ...candidate, status: "deleted", updatedAt: new Date().toISOString() }
      : candidate));
    return true;
  }

  function reportMint(context: MintPermissionContext, reason: ContentReport["reason"], details: string | null) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canViewMint(context)) return false;
    setReports((current) => [...current, { id: localId("mint-report"), reporterId: viewerId, targetType: "mint", targetId: context.mint.id, reason, details, createdAt: new Date().toISOString() }]);
    return true;
  }

  function reportComment(context: MintPermissionContext, commentId: string, reason: ContentReport["reason"] = "other") {
    const viewerId = context.viewer?.account.id;
    const comment = comments.find((candidate) => candidate.id === commentId && candidate.status === "active");
    if (!viewerId || !comment || !canViewMint(context)) return false;
    setReports((current) => [...current, { id: localId("comment-report"), reporterId: viewerId, targetType: "comment", targetId: commentId, reason, details: null, createdAt: new Date().toISOString() }]);
    return true;
  }

  return {
    mintz,
    currentTime,
    likes,
    comments,
    saves,
    shares,
    reports,
    pendingNotifications,
    createMint,
    toggleLike,
    addComment,
    deleteOwnComment,
    toggleSave,
    recordShare,
    updateOwnMint,
    toggleArchive,
    deleteOwnMint,
    reportMint,
    reportComment,
  };
}

export type MintzState = ReturnType<typeof useMintz>;
