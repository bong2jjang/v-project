/**
 * v-itsm Loop Transition 편집/삭제/복원/리비전 API 클라이언트.
 */

import { apiClient, get, post } from "./client";
import type {
  LoopTransitionDetail,
  LoopTransitionRevision,
  TransitionDeleteInput,
  TransitionEditInput,
  TransitionRestoreInput,
  TransitionRevertInput,
} from "./itsmTypes";

function basePath(ticketId: string, transitionId: string): string {
  return `/api/tickets/${ticketId}/transitions/${transitionId}`;
}

export async function editTransition(
  ticketId: string,
  transitionId: string,
  data: TransitionEditInput,
): Promise<LoopTransitionDetail> {
  const response = await apiClient.patch<LoopTransitionDetail>(
    basePath(ticketId, transitionId),
    data,
  );
  return response.data;
}

export async function deleteTransition(
  ticketId: string,
  transitionId: string,
  data: TransitionDeleteInput = {},
): Promise<LoopTransitionDetail> {
  const response = await apiClient.delete<LoopTransitionDetail>(
    basePath(ticketId, transitionId),
    { data },
  );
  return response.data;
}

export async function restoreTransition(
  ticketId: string,
  transitionId: string,
  data: TransitionRestoreInput = {},
): Promise<LoopTransitionDetail> {
  return post<LoopTransitionDetail>(
    `${basePath(ticketId, transitionId)}/restore`,
    data,
  );
}

export async function listRevisions(
  ticketId: string,
  transitionId: string,
): Promise<LoopTransitionRevision[]> {
  return get<LoopTransitionRevision[]>(
    `${basePath(ticketId, transitionId)}/revisions`,
  );
}

export async function revertToRevision(
  ticketId: string,
  transitionId: string,
  revisionNo: number,
  data: TransitionRevertInput = {},
): Promise<LoopTransitionDetail> {
  return post<LoopTransitionDetail>(
    `${basePath(ticketId, transitionId)}/revisions/${revisionNo}/revert`,
    data,
  );
}
