import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, ErrorCode } from '@/_new/lib/errors';
import { CallButton } from './components/call-button';
import { DailyCallProvider } from './daily-call-provider';

type Handler = (event?: unknown) => void;

interface FakeCall {
  handlers: Map<string, Handler[]>;
  emit: (event: string, payload?: unknown) => void;
  on: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  isDestroyed: () => boolean;
  iframe: () => HTMLIFrameElement | null;
  localAudio: ReturnType<typeof vi.fn>;
  setLocalAudio: ReturnType<typeof vi.fn>;
}

const daily = vi.hoisted(() => ({
  calls: [] as unknown[],
  createFrame: vi.fn(),
}));
const api = vi.hoisted(() => ({ createBoardCall: vi.fn() }));

vi.mock('@daily-co/daily-js', () => ({ default: { createFrame: daily.createFrame } }));
vi.mock('./api/callApi', () => ({ createBoardCall: api.createBoardCall }));

const fakeCalls = () => daily.calls as FakeCall[];

/** Atrapa instancji z `DailyIframe.createFrame`: wstawia <iframe> do kontenera jak daily-js. */
function makeFakeCall(container: HTMLElement): FakeCall {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('allow', 'microphone; camera; autoplay');
  container.appendChild(iframe);
  let destroyed = false;
  let audio = true;
  const handlers = new Map<string, Handler[]>();
  const call: FakeCall = {
    handlers,
    emit: (event, payload) => (handlers.get(event) ?? []).forEach((handler) => handler(payload)),
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return call;
    }),
    // Jak w Daily z ekranem wejścia: join() rozstrzyga się dopiero po dołączeniu.
    join: vi.fn(() => new Promise(() => {})),
    leave: vi.fn(async () => {}),
    destroy: vi.fn(async () => {
      destroyed = true;
      iframe.remove();
    }),
    isDestroyed: () => destroyed,
    iframe: () => (destroyed ? null : iframe),
    localAudio: vi.fn(() => audio),
    setLocalAudio: vi.fn((value: boolean) => {
      audio = value;
      return call;
    }),
  };
  return call;
}

/** Wartości generowane w czasie testu - żadnych literałów wyglądających na sekret. */
const roomUrl = `https://example.daily.co/room-${crypto.randomUUID()}`;
const callToken = crypto.randomUUID();
const session = () => ({ room_url: roomUrl, token: callToken, expires_at: '2026-10-05T10:00:00Z' });

function renderCall(boardId: number | null = 7) {
  return render(
    <DailyCallProvider boardId={boardId}>
      <CallButton />
    </DailyCallProvider>
  );
}

const clickCall = () => fireEvent.click(screen.getByTestId('call-button'));
const panel = () => screen.getByTestId('call-panel');
const frames = () => document.querySelectorAll('iframe');

async function startCall() {
  clickCall();
  await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(panel()).toBeVisible());
  return fakeCalls()[0];
}

beforeEach(() => {
  daily.calls.length = 0;
  daily.createFrame.mockImplementation((container: HTMLElement) => {
    const call = makeFakeCall(container);
    daily.calls.push(call);
    return call;
  });
  api.createBoardCall.mockImplementation(async () => session());
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DailyCallProvider - start rozmowy', () => {
  it('klik -> API tablicy -> createFrame w kontenerze panelu -> join z adresem pokoju i tokenem', async () => {
    renderCall(7);
    expect(panel()).not.toBeVisible();

    const call = await startCall();

    expect(api.createBoardCall).toHaveBeenCalledWith(7);
    const [container, options] = daily.createFrame.mock.calls[0];
    expect(container).toBe(screen.getByTestId('call-frame'));
    // Domyślnie samo audio - kamerę włącza użytkownik w oknie Daily.
    expect(options).toMatchObject({ startVideoOff: true, startAudioOff: false, lang: 'pl' });
    expect(call.join).toHaveBeenCalledWith({ url: roomUrl, token: callToken });
    expect(frames()).toHaveLength(1);
  });

  it('ramka ma allow z mikrofonem, kamerą, autoplay i udostępnianiem ekranu', async () => {
    renderCall();
    await startCall();
    const allow = frames()[0].getAttribute('allow') ?? '';
    for (const name of ['microphone', 'camera', 'autoplay', 'display-capture']) {
      expect(allow).toContain(name);
    }
  });

  it('podwójne kliknięcie nie tworzy dwóch instancji', async () => {
    renderCall();
    clickCall();
    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(panel()).toBeVisible());
    // Kolejny klik w trakcie rozmowy tylko zwija okno.
    clickCall();
    expect(api.createBoardCall).toHaveBeenCalledTimes(1);
    expect(daily.createFrame).toHaveBeenCalledTimes(1);
    expect(frames()).toHaveLength(1);
  });

  it('StrictMode: podwójny montaż nie zostawia drugiej instancji', async () => {
    render(
      <StrictMode>
        <DailyCallProvider boardId={7}>
          <CallButton />
        </DailyCallProvider>
      </StrictMode>
    );
    await startCall();
    expect(daily.createFrame).toHaveBeenCalledTimes(1);
    expect(frames()).toHaveLength(1);
  });

  it('token rozmowy nie trafia do logów ani do adresu ramki', async () => {
    const spies = (['log', 'debug', 'info', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {})
    );
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '1');
    renderCall();
    const call = await startCall();
    act(() => call.emit('error', { error: { type: 'ejected' }, errorMsg: callToken }));
    await waitFor(() => expect(screen.getByTestId('call-notice')).toBeInTheDocument());

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(callToken);
    expect(document.body.innerHTML).not.toContain(callToken);
    expect(window.location.href).not.toContain(callToken);
    vi.unstubAllEnvs();
  });
});

describe('DailyCallProvider - błędy', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('503 VOICE_NOT_CONFIGURED -> komunikat "wyłączone", brak ramki, przycisk zostaje', async () => {
    api.createBoardCall.mockRejectedValueOnce(
      new AppError('Rozmowy nie są skonfigurowane', 'VOICE_NOT_CONFIGURED', 503)
    );
    renderCall();
    clickCall();

    const notice = await screen.findByTestId('call-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('data-kind', 'disabled');
    expect(notice).toHaveTextContent('Rozmowy głosowe są chwilowo wyłączone');
    expect(screen.queryByText('Spróbuj ponownie')).not.toBeInTheDocument();
    expect(daily.createFrame).not.toHaveBeenCalled();
    expect(frames()).toHaveLength(0);
    expect(panel()).not.toBeVisible();
    expect(screen.getByTestId('call-button')).toBeEnabled();
  });

  it.each([
    ['404 (backend bez endpointu)', new AppError('Nie znaleziono', ErrorCode.NOT_FOUND, 404)],
    ['405', new AppError('Method Not Allowed', ErrorCode.APP_ERROR, 405)],
    ['502 dostawcy', new AppError('Błąd dostawcy', 'VOICE_PROVIDER_ERROR', 502)],
    ['504 dostawcy', new AppError('Timeout', 'VOICE_PROVIDER_TIMEOUT', 504)],
    ['błąd sieci', new AppError('Brak połączenia z serwerem', ErrorCode.NETWORK_ERROR, 0)],
    ['nieznany wyjątek', new Error('boom')],
  ])('%s -> komunikat błędu i można ponowić', async (_name, error) => {
    api.createBoardCall.mockRejectedValueOnce(error);
    renderCall();
    clickCall();

    const notice = await screen.findByTestId('call-notice');
    expect(notice).toHaveAttribute('data-kind', 'error');
    expect(notice).toHaveTextContent('Nie udało się połączyć z rozmową');
    expect(frames()).toHaveLength(0);

    fireEvent.click(screen.getByText('Spróbuj ponownie'));
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(panel()).toBeVisible());
    expect(api.createBoardCall).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('call-notice')).not.toBeInTheDocument();
  });

  it('429 -> prośba o odczekanie; inny kod VOICE_* -> komunikat z backendu', async () => {
    api.createBoardCall.mockRejectedValueOnce(
      new AppError('Zbyt wiele żądań', 'RATE_LIMITED', 429)
    );
    renderCall();
    clickCall();
    expect(await screen.findByTestId('call-notice')).toHaveTextContent('Zbyt wiele prób');

    api.createBoardCall.mockRejectedValueOnce(
      new AppError('Limit rozmów w tym miesiącu wyczerpany', 'VOICE_LIMIT_REACHED', 503)
    );
    clickCall();
    await waitFor(() =>
      expect(screen.getByTestId('call-notice')).toHaveTextContent(
        'Limit rozmów w tym miesiącu wyczerpany'
      )
    );
  });

  it('brak navigator.mediaDevices -> komunikat, bez wywołania API', async () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });
    renderCall();
    clickCall();

    const notice = await screen.findByTestId('call-notice');
    expect(notice).toHaveAttribute('data-kind', 'unsupported');
    expect(api.createBoardCall).not.toHaveBeenCalled();
    expect(daily.createFrame).not.toHaveBeenCalled();
  });

  it('createFrame rzuca (np. WebRTC wyłączone) -> komunikat zamiast wyjątku', async () => {
    daily.createFrame.mockImplementationOnce(() => {
      throw new Error('WebRTC not supported or suppressed');
    });
    renderCall();
    clickCall();
    expect(await screen.findByTestId('call-notice')).toHaveAttribute('data-kind', 'error');
    expect(panel()).not.toBeVisible();
    expect(screen.getByTestId('call-button')).toBeEnabled();
  });

  it('join odrzucone -> komunikat i sprzątnięta instancja', async () => {
    renderCall();
    daily.createFrame.mockImplementationOnce((container: HTMLElement) => {
      const call = makeFakeCall(container);
      call.join.mockRejectedValueOnce(new Error('join failed'));
      daily.calls.push(call);
      return call;
    });
    clickCall();

    expect(await screen.findByTestId('call-notice')).toHaveAttribute('data-kind', 'error');
    await waitFor(() => expect(fakeCalls()[0].destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
  });

  it('zdarzenie error z Daily -> komunikat o przerwanej rozmowie i sprzątnięcie', async () => {
    renderCall();
    const call = await startCall();
    act(() => call.emit('error', { error: { type: 'connection-error' } }));

    expect(await screen.findByTestId('call-notice')).toHaveTextContent('Rozmowa została przerwana');
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
  });
});

describe('DailyCallProvider - okno rozmowy', () => {
  it('zwinięcie nie odmontowuje ramki ani nie chowa jej przez display:none', async () => {
    renderCall();
    const call = await startCall();
    const iframe = frames()[0];
    const frameBox = screen.getByTestId('call-frame');

    fireEvent.click(screen.getByTestId('call-minimize'));

    expect(panel()).toHaveAttribute('data-minimized', 'true');
    expect(frames()[0]).toBe(iframe);
    expect(iframe.isConnected).toBe(true);
    expect(screen.getByTestId('call-frame')).toBe(frameBox);
    expect(frameBox.style.display).not.toBe('none');
    expect(panel().style.display).not.toBe('none');
    expect(call.destroy).not.toHaveBeenCalled();
    expect(call.leave).not.toHaveBeenCalled();
    // Belka z wycisz / rozłącz zostaje.
    expect(screen.getByTestId('call-mute')).toBeVisible();
    expect(screen.getByTestId('call-leave')).toBeVisible();

    fireEvent.click(screen.getByTestId('call-minimize'));
    expect(panel()).toHaveAttribute('data-minimized', 'false');
    expect(frames()[0]).toBe(iframe);
    expect(daily.createFrame).toHaveBeenCalledTimes(1);
  });

  it('wyciszenie działa po dołączeniu i idzie przez setLocalAudio', async () => {
    renderCall();
    const call = await startCall();
    expect(screen.getByTestId('call-mute')).toBeDisabled();

    act(() => call.emit('joined-meeting'));
    expect(screen.getByTestId('call-mute')).toBeEnabled();

    fireEvent.click(screen.getByTestId('call-mute'));
    expect(call.setLocalAudio).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('call-mute')).toHaveAttribute('aria-pressed', 'true');

    // Zmiana zrobiona w oknie Daily też odświeża belkę.
    act(() => call.emit('participant-updated', { participant: { local: true, audio: true } }));
    expect(screen.getByTestId('call-mute')).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Rozłącz" niszczy instancję i pozwala zacząć od nowa', async () => {
    renderCall();
    const call = await startCall();

    fireEvent.click(screen.getByTestId('call-leave'));
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
    await waitFor(() => expect(frames()).toHaveLength(0));

    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(2));
    expect(frames()).toHaveLength(1);
  });

  it('wyjście kliknięte w oknie Daily (left-meeting) zamyka panel', async () => {
    renderCall();
    const call = await startCall();
    act(() => call.emit('left-meeting'));
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();
  });

  it('odmontowanie niszczy instancję', async () => {
    const view = renderCall();
    const call = await startCall();
    view.unmount();
    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(frames()).toHaveLength(0);
  });

  it('zmiana tablicy kończy rozmowę z poprzedniej', async () => {
    const view = renderCall(7);
    const call = await startCall();

    view.rerender(
      <DailyCallProvider boardId={8}>
        <CallButton />
      </DailyCallProvider>
    );

    await waitFor(() => expect(call.destroy).toHaveBeenCalledTimes(1));
    expect(panel()).not.toBeVisible();

    clickCall();
    await waitFor(() => expect(daily.createFrame).toHaveBeenCalledTimes(2));
    expect(api.createBoardCall).toHaveBeenLastCalledWith(8);
  });

  it('zmiana tablicy w trakcie łączenia nie tworzy ramki dla starej tablicy', async () => {
    let resolveCall: (value: ReturnType<typeof session>) => void = () => {};
    api.createBoardCall.mockImplementationOnce(
      () => new Promise((resolve) => (resolveCall = resolve))
    );
    const view = renderCall(7);
    clickCall();
    await waitFor(() => expect(api.createBoardCall).toHaveBeenCalledTimes(1));

    view.rerender(
      <DailyCallProvider boardId={8}>
        <CallButton />
      </DailyCallProvider>
    );
    await act(async () => {
      resolveCall(session());
      await Promise.resolve();
    });

    expect(daily.createFrame).not.toHaveBeenCalled();
    expect(panel()).not.toBeVisible();
    expect(screen.getByTestId('call-button')).toBeEnabled();
  });

  it('destroy, które się nie kończy -> ramka usuwana po limicie czasu', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderCall();
    const call = await startCall();
    call.destroy.mockImplementationOnce(() => new Promise(() => {}));

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByTestId('call-leave'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(frames()).toHaveLength(0);
    // Druga próba destroy() - bez ramki daily-js kończy ją od razu i wyrejestrowuje instancję.
    expect(call.destroy).toHaveBeenCalledTimes(2);
  });
});

describe('CallButton', () => {
  it('poza providerem i bez liczbowego id tablicy (demo) nie renderuje nic', () => {
    const { unmount } = render(<CallButton />);
    expect(screen.queryByTestId('call-button')).not.toBeInTheDocument();
    unmount();

    renderCall(null);
    expect(screen.queryByTestId('call-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('call-panel')).not.toBeInTheDocument();
  });

  it('compact: sama ikona, opis w aria-label', () => {
    render(
      <DailyCallProvider boardId={7}>
        <CallButton compact />
      </DailyCallProvider>
    );
    const button = screen.getByTestId('call-button');
    expect(button).toHaveAttribute('aria-label', 'Rozmowa');
    expect(button).not.toHaveTextContent('Rozmowa');
  });
});
