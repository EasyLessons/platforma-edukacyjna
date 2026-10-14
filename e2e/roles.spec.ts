import { test, expect, type APIRequestContext } from '@playwright/test';
import { E2E_PASSWORD, E2E_USERS, closeBoard, openPageAs, seedState } from './helpers';

/**
 * Role w przestrzeni (decyzja B): tworzenie tablic, zaproszenia i share-linki tylko dla
 * właściciela przestrzeni. Źródłem prawdy jest backend, UI tylko ukrywa akcje.
 */
const API = `http://localhost:${process.env.E2E_BACKEND_PORT ?? 8210}/api/v1`;

async function apiToken(request: APIRequestContext, username: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { login: `${username}@example.com`, password: E2E_PASSWORD },
  });
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: { access_token: string } };
  return body.data.access_token;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

test('editor nie tworzy tablicy: brak przycisku w UI i 403 z backendu', async ({
  browser,
  request,
}) => {
  const { workspace_id } = seedState();
  const dashboard = `/dashboard?workspace=${workspace_id}`;

  // Owner widzi przycisk
  const owner = await openPageAs(browser, E2E_USERS.owner, dashboard);
  await expect(owner.getByRole('button', { name: /Nowa tablica/ })).toBeVisible();
  await closeBoard(owner);

  // Editor go nie widzi, ale lista tablic się ładuje
  const editor = await openPageAs(browser, E2E_USERS.editor, dashboard);
  await expect(editor.getByRole('heading', { name: /Tablice/ })).toBeVisible();
  await expect(editor.getByRole('button', { name: /Nowa tablica/ })).toHaveCount(0);
  await closeBoard(editor);

  // Backend odmawia niezależnie od UI
  const token = await apiToken(request, E2E_USERS.editor);
  const create = await request.post(`${API}/boards`, {
    headers: bearer(token),
    data: { name: 'Tablica edytora', workspace_id, icon: 'FileText', bg_color: 'green-500' },
  });
  expect(create.status()).toBe(403);
});

test('editor nie zaprasza i nie tworzy share-linku (403), viewer nie wgrywa plików', async ({
  request,
}) => {
  const { workspace_id, board_id } = seedState();

  const editorToken = await apiToken(request, E2E_USERS.editor);
  const link = await request.post(`${API}/workspaces/${workspace_id}/share-link`, {
    headers: bearer(editorToken),
  });
  expect(link.status()).toBe(403);

  const search = await request.get(`${API}/workspaces/${workspace_id}/invite/users?query=e2e_`, {
    headers: bearer(editorToken),
  });
  expect(search.status()).toBe(403);

  const rename = await request.put(`${API}/boards/${board_id}`, {
    headers: bearer(editorToken),
    data: { name: 'Zmiana przez edytora' },
  });
  expect(rename.status()).toBe(403);

  const viewerToken = await apiToken(request, E2E_USERS.viewer);
  const upload = await request.post(`${API}/whiteboard/${board_id}/upload-image`, {
    headers: bearer(viewerToken),
    multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('x') } },
  });
  expect(upload.status()).toBe(403);
});
