/**
 * Publiczne API feature'a `dashboard` (panel uzytkownika po zalogowaniu).
 *
 * Strony w src/app/(dashboard) skladaja widok wylacznie z tego, co jest tu
 * wyeksportowane. Logika danych (workspace'y, boardy, powiadomienia) zostaje
 * w features/workspace, features/board, features/notifications - ten feature
 * to tylko uklad i komponenty panelu (PR-A5 z docs/architecture/REFAKTOR-PLAN.md).
 *
 * Uwaga: komponenty korzystaja z klas `dashboard-*` zdefiniowanych w
 * src/app/(dashboard)/dashboard/dashboard-theme.css, ladowanych przez layout
 * grupy (dashboard).
 */

export { default as BoardsSection } from './components/BoardsSection';
export { default as RecentsView } from './components/RecentsView';
export { default as TemplatesSection } from './components/TemplateSection';
export { default as WorkspaceSidebar } from './components/workspace-sidebar';
export { default as WorkspaceTopNav } from './components/workspace-top-nav';
export { OpenWorkspacesButton } from './components/open-workspaces-button';
export { default as DashboardHeader } from './components/header/DashboardHeader';
