export type SportsNavigationState = {
  scheduleOpen: boolean;
  selectedTeamId: string | null;
};

export type SportsNavigationAction =
  | { type: "toggle-schedule" }
  | { type: "close-schedule" }
  | { type: "select-team"; teamId: string }
  | { type: "back" }
  | { type: "reset" };

export const initialSportsNavigationState: SportsNavigationState = {
  scheduleOpen: false,
  selectedTeamId: null,
};

export function sportsNavigationReducer(
  state: SportsNavigationState,
  action: SportsNavigationAction,
): SportsNavigationState {
  if (action.type === "toggle-schedule") {
    return { ...state, scheduleOpen: !state.scheduleOpen };
  }

  if (action.type === "close-schedule") {
    return { ...state, scheduleOpen: false };
  }

  if (action.type === "select-team") {
    return { scheduleOpen: false, selectedTeamId: action.teamId };
  }

  if (action.type === "back") {
    return { ...state, selectedTeamId: null };
  }

  return initialSportsNavigationState;
}
