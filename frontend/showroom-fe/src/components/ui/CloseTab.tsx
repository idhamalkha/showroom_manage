import React from 'react';
import './CloseTab.css';

type AnimateOptions = {
  duration?: number; // ms
  target?: { x: number; y: number } | null; // screen coords to shrink toward (defaults to center)
  scale?: number; // final scale multiplier (default very small)
  beep?: boolean; // play a short beep
};

function playBeep(volume = 0.08, freq = 880, type: OscillatorType = 'sine', dur = 0.09) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.005);
    o.start(now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.stop(now + dur + 0.02);
    // close AudioContext after a short while
    setTimeout(() => { try { ctx.close(); } catch {} }, (dur + 0.05) * 1000);
  } catch (err) {
    // ignore audio errors on unsupported environments
  }
}

/**
 * Animate an element closing like a game tab: clone, float, shrink toward target, fade and remove.
 * Returns a Promise that resolves when animation finishes.
 */
export async function animateCloseTab(el: Element, opts: AnimateOptions = {}) {
  if (!el || !(el instanceof Element)) return;
  // avoid double-run for the same element
  (animateCloseTab as any)._animating = (animateCloseTab as any)._animating || new WeakSet();
  if ((animateCloseTab as any)._animating.has(el)) return;
  // mark as animating early to prevent race conditions
  (animateCloseTab as any)._animating.add(el);
  const rect = el.getBoundingClientRect();
  // create a lightweight visual clone (shallow) to avoid cloning heavy children
  const clone = document.createElement('div');
  clone.classList.add('ctc-clone');
  // copy computed styles that are important for look
  const cs = window.getComputedStyle(el as Element);
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.margin = '0';
  clone.style.boxSizing = 'border-box';
  // copy lightweight appearance attributes
  clone.style.background = cs.background || cs.backgroundColor || 'white';
  clone.style.color = cs.color || 'inherit';
  clone.style.borderRadius = cs.borderRadius || '';
  if (cs.boxShadow) clone.style.boxShadow = cs.boxShadow;
  if (cs.border) clone.style.border = cs.border;
  // some elements (like buttons) may rely on inline display - ensure good rendering
  clone.style.display = 'block';

  // hide original element to avoid visual duplication while clone animates
  const originalEl = el as HTMLElement;
  const prevVisibility = originalEl.style.visibility;
  try {
    originalEl.style.visibility = 'hidden';
  } catch {}

  document.body.appendChild(clone);
  // mark as animating
  (animateCloseTab as any)._animating = (animateCloseTab as any)._animating || new WeakSet();
  (animateCloseTab as any)._animating.add(el);

  const duration = opts.duration ?? 520;
  // finalScale unused because we preserve the compressed line's thickness
  const target = opts.target ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // compute translate to target center
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = (target.x - cx);
  const dy = (target.y - cy);

  // helper to wait for next frame
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  // force reflow so transition applies
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  clone.offsetWidth;

  // play small beep if requested (slightly higher pitch and short)
  if (opts.beep !== false) playBeep(0.08, 1100, 'sine', 0.08);
  // Prepare clone for the TV-off compression: compress the clone itself
  // vertically into a thin horizontal line, then move/fade that line to the target.
  clone.style.overflow = 'hidden';
  clone.classList.add('ctc-line-candidate');
  // create a thin rounded line element that will be the visible result when
  // the clone compresses; keep it hidden initially
  const lineEl = document.createElement('div');
  lineEl.className = 'ctc-line';
  lineEl.style.position = 'absolute';
  lineEl.style.left = '8%';
  lineEl.style.right = '8%';
  lineEl.style.height = '2px';
  lineEl.style.top = '50%';
  lineEl.style.transform = 'translateY(-50%) scaleX(1)';
  lineEl.style.transformOrigin = 'center center';
  lineEl.style.background = 'rgba(0,0,0,0.95)';
  // use a polygon clip-path so the ends can be sharp/pointed
  lineEl.style.borderRadius = '0';
  lineEl.style.clipPath = 'polygon(0% 50%, 6% 0%, 94% 0%, 100% 50%, 94% 100%, 6% 100%)';
  lineEl.style.opacity = '0';
  lineEl.style.pointerEvents = 'none';
  lineEl.style.zIndex = '6000';
  clone.appendChild(lineEl);

  // if element has zero size (maybe just mounted), fall back to center-size animation
  const fallback = !(rect.width > 0 && rect.height > 0);
  if (fallback) {
    // place clone at center with a default size
    const w = Math.min(540, window.innerWidth * 0.9);
    const h = Math.min(360, window.innerHeight * 0.7);
    clone.style.left = `${(window.innerWidth - w) / 2}px`;
    clone.style.top = `${(window.innerHeight - h) / 2}px`;
    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;
  }

  // stage animations: squash -> compress clone into line -> move/fade

  // Stage 1: quick squash (vertical) to mimic screen shutting down
  requestAnimationFrame(() => {
    clone.style.transition = `transform ${Math.min(160, duration / 4)}ms cubic-bezier(.25,.46,.45,.94)`;
    // small vertical squash while keeping position
    clone.style.transform = `translate3d(0px, 0px, 0) scaleY(0.92)`;
  });
  await raf();
  await new Promise((res) => setTimeout(res, Math.min(160, duration / 4) + 26));

  // make the internal line visible; set its color to the modal's background color
  const lineColor = (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') ? cs.backgroundColor : (cs.background || 'rgba(0,0,0,0.95)');
  lineEl.style.background = lineColor;
  // ensure clone looks consistent with modal
  clone.style.background = cs.background || cs.backgroundColor || 'white';
  requestAnimationFrame(() => {
    try {
      lineEl.style.transition = `opacity ${Math.min(200, duration / 2)}ms ease, transform ${Math.min(340, duration)}ms cubic-bezier(.22,.9,.28,1)`;
      lineEl.style.opacity = '1';
      lineEl.style.transform = 'translateY(-50%) scaleX(1)';
    } catch {}
    clone.style.transition = `transform ${Math.min(360, duration)}ms cubic-bezier(.22,.9,.28,1)`;
    // compress the clone so the line becomes the visible element
    clone.style.transform = `translate3d(0px, 0px, 0) scaleY(0.02)`;
  });
  await raf();
  await new Promise((res) => setTimeout(res, Math.min(360, duration) + 20));

  // Stage 3: move the thin line toward target and fade — don't change its thickness
  requestAnimationFrame(() => {
    clone.style.transition = `transform ${duration}ms cubic-bezier(.22,.9,.28,1), opacity ${Math.min(320, duration)}ms ease`;
    // Preserve the vertical squash (scaleY) while only translating horizontally/vertically
    clone.style.transform = `translate3d(${dx}px, ${dy}px, 0) scaleY(0.02)`;
    clone.style.opacity = '0';
  });

  try {
    await new Promise<void>((res) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { clone.remove(); } catch {}
      res();
    }, duration + 80);

    function onTrans(e: TransitionEvent) {
      if (e.target !== clone || e.propertyName !== 'transform') return;
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { clone.remove(); } catch {}
      res();
    }

    clone.addEventListener('transitionend', onTrans, { once: true });
    });
  } finally {
    try { (animateCloseTab as any)._animating.delete(el); } catch {}
    // Original element is removed/hidden by parent - but restore visibility if needed
    try { originalEl.style.visibility = prevVisibility; } catch {}
  }
  
}

// Example small React helper: a button that animates its own parent/tab then calls onClose
export function CloseTabButton({ children, onClose, target }: { children?: React.ReactNode; onClose?: () => void; target?: { x: number; y: number } }) {
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const handle = async (e: React.MouseEvent) => {
    const el = (ref.current as HTMLElement) || (e.currentTarget as HTMLElement);
    await animateCloseTab(el, { target, beep: true });
    try { onClose?.(); } catch {}
  };
  return (
    <button ref={ref} className="btn neutral" onClick={handle}>
      {children ?? 'Close'}
    </button>
  );
}

export default animateCloseTab;
