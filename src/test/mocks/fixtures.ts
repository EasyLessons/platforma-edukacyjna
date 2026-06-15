import type { Board, BoardListResponse, BoardMembersResponse } from '@new/features/board/types';
import type {
  Workspace,
  WorkspaceListResponse,
  WorkspaceMembersResponse,
  InviteResponse,
  InviteStatusResponse,
  PendingInviteResponse,
  AcceptInviteResponse,
  MyRoleResponse,
} from '@new/features/workspace/types';
import type { Notification, NotificationsListResponse } from '@new/features/notifications/types';

// ─── BOARD FIXTURES ────────────────────────────────────────────────────────

export const mockBoard: Board = {
  id: 1,
  name: 'Test Board',
  icon: 'PenTool',
  bg_color: 'gray-500',
  workspace_id: 10,
  owner_id: 1,
  owner_username: 'testuser',
  is_favourite: false,
  settings: null,
  last_modified: '2024-06-01T12:00:00Z',
  last_modified_by: null,
  last_opened: null,
  created_at: '2024-01-01T00:00:00Z',
  created_by: 'testuser',
};

export const mockBoardListResponse: BoardListResponse = {
  boards: [mockBoard],
  total: 1,
  limit: 10,
  offset: 0,
};

export const mockBoardMembersResponse: BoardMembersResponse = {
  members: [
    {
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'owner',
      is_owner: true,
      joined_at: '2024-01-01T00:00:00Z',
    },
  ],
};

// ─── WORKSPACE FIXTURES ────────────────────────────────────────────────────

export const mockWorkspace: Workspace = {
  id: 10,
  name: 'Test Workspace',
  icon: 'Home',
  bg_color: 'green-500',
  created_by: 1,
  member_count: 2,
  board_count: 1,
  is_owner: true,
  role: 'owner',
  is_favourite: false,
};

export const mockWorkspaceListResponse: WorkspaceListResponse = {
  workspaces: [mockWorkspace],
  total: 1,
};

export const mockWorkspaceMember = {
  id: 1,
  user_id: 1,
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'owner',
  joined_at: '2024-01-01T00:00:00Z',
  is_owner: true,
};

export const mockWorkspaceMembersResponse: WorkspaceMembersResponse = {
  members: [mockWorkspaceMember],
  total: 1,
};

export const mockInviteResponse: InviteResponse = {
  id: 1,
  workspace_id: 10,
  invited_by: 1,
  invited_id: 2,
  invite_token: 'abc-token-123',
  expires_at: '2024-12-31T00:00:00Z',
  created_at: '2024-06-01T00:00:00Z',
};

export const mockPendingInvite: PendingInviteResponse = {
  id: 1,
  workspace_id: 10,
  workspace_name: 'Test Workspace',
  workspace_icon: 'Home',
  workspace_bg_color: 'green-500',
  invited_by: 1,
  inviter_name: 'testuser',
  invited_id: 2,
  invited_user_name: 'otheruser',
  invite_token: 'abc-token-123',
  expires_at: '2024-12-31T00:00:00Z',
  created_at: '2024-06-01T00:00:00Z',
};

export const mockAcceptInviteResponse: AcceptInviteResponse = {
  message: 'Zaproszenie zaakceptowane',
  workspace_id: 10,
  workspace_name: 'Test Workspace',
  role: 'editor',
};

export const mockInviteStatus: InviteStatusResponse = {
  is_member: false,
  has_pending_invite: false,
  can_invite: true,
};

export const mockMyRoleResponse: MyRoleResponse = {
  role: 'owner',
  is_owner: true,
  workspace_id: 10,
};

// ─── NOTIFICATION FIXTURES ─────────────────────────────────────────────────

export const mockNotification: Notification = {
  id: 1,
  user_id: 1,
  type: 'invite',
  payload: {
    workspace_id: 10,
    workspace_name: 'Test Workspace',
    workspace_icon: 'Home',
    workspace_bg_color: 'green-500',
    inviter_name: 'admin',
    invite_token: 'abc-token-123',
    expires_at: '2024-12-31T00:00:00Z',
    created_at: '2024-06-01T00:00:00Z',
  },
  is_read: false,
  created_at: '2024-06-01T00:00:00Z',
  read_at: null,
};

export const mockNotificationsListResponse: NotificationsListResponse = {
  notifications: [mockNotification],
  unread_count: 1,
};
