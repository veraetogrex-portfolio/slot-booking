// Slot Booking — github.com/veraetogrex-portfolio · zero dependencies
// Pick a day, pick a slot, done: the disc flies to the new day on an arc, slots cascade in,
// the slot splits to reveal Confirm, and the widget folds into an Ion "Booked" card.

const root   = document.querySelector('#booking');
const grid   = root.querySelector('.sb-grid');
const disc   = root.querySelector('.sb-disc');
const ghost  = root.querySelector('.sb-ghost');
const list   = root.querySelector('.sb-list');
const box    = root.querySelector('.sb-box');
const cols   = root.querySelector('.sb-cols');
const booked = root.querySelector('.sb-booked');
const sub    = root.querySelector('.sb-sub');
const wash   = document.querySelector('.sb-wash');

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL = new Set([4, 18, 26]);                       // fully booked days
const POOL = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
const SLOTS = { 10: ['09:00', '10:30', '11:00', '13:30', '15:00', '16:30'], 13: ['09:30', '11:00', '13:00', '14:30', '16:00', '17:30'] };
const slotsFor = d => SLOTS[d] || POOL.filter((_, k) => (k + d) % 3 === 0).slice(0, 6);   // replace with your API
const dow = d => (d + 5) % 7;                             // Nov 1, 2026 is a Sunday
const label = d => `${WEEKDAYS[dow(d)]}, Nov ${d}`;

// tiny tween: tween(ms, t => …, easing)
const ease = { io: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2, out: t => 1 - (1 - t) ** 3, in: t => t ** 3 };
const tween = (ms, fn, e = ease.io) => new Promise(done => {
  const t0 = performance.now();
  const step = now => { const p = Math.min(1, (now - t0) / ms); fn(e(p), p); p < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;

// calendar: Oct 26–31 padding, then November
const cells = {};
for (let d = 26; d <= 31; d++) grid.insertAdjacentHTML('beforeend', `<div class="sb-day-cell is-out">${d}</div>`);
for (let d = 1; d <= 30; d++) {
  const weekend = dow(d) >= 5, b = document.createElement('button');
  b.className = 'sb-day-cell ' + (weekend ? 'is-off' : FULL.has(d) ? 'is-full' : 'is-open');
  b.textContent = d; b.disabled = weekend;
  b.setAttribute('aria-label', `November ${d}${FULL.has(d) ? ', fully booked' : ''}`);
  b.addEventListener('click', () => FULL.has(d) ? fullyBooked(d) : pickDay(d));
  cells[d] = grid.appendChild(b);
}
const at = d => [cells[d].offsetLeft, cells[d].offsetTop];

let day = 10, slot = null, phase = 'pick';

// 1 · the disc flies to the new day on an arc, dipping in size mid-flight
async function pickDay(d) {
  if (phase !== 'pick' || d === day) return;
  const [x0, y0] = at(day), [x1, y1] = at(d), from = `translate(${x0}px,${y0}px)`;
  cells[day].classList.remove('is-sel'); day = d; slot = null;
  ghost.animate([{ opacity: .8, transform: from }, { opacity: 0, transform: from + ' scale(1.5)' }], 500);
  showSlots(d);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - Math.max(40, Math.hypot(x1 - x0, y1 - y0) * .45);
  await tween(450, (t, p) => {
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * mx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * my + t * t * y1;
    disc.style.transform = `translate(${x}px,${y}px) scale(${1 - .22 * Math.sin(Math.PI * p)})`;
    if (p > .72) cells[d].classList.add('is-sel');
  });
  await tween(220, t => disc.style.transform =
    `translate(${x1}px,${y1}px) scale(${1 + .1 * Math.sin(Math.PI * t)})`, ease.out);
}

// 2 · old slots slide out, the new day's slots cascade in 55 ms apart
async function showSlots(d, animate = true) {
  if (animate) {
    [...list.children].forEach((r, k) => r.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(16px)' }],
      { duration: 160, delay: k * 22, fill: 'forwards' }));
    await wait(190);
  }
  root.querySelector('.sb-day').textContent = label(d);
  sub.textContent = `${slotsFor(d).length} slots · 30 min`;
  list.innerHTML = slotsFor(d).map(t => `<div class="sb-slot"><button class="sb-time">${t}</button>` +
    `<button class="sb-confirm">Confirm</button></div>`).join('');
  [...list.children].forEach((row, k) => {
    row.querySelector('.sb-time').onclick = () => pickSlot(row);
    row.querySelector('.sb-confirm').onclick = book;
    if (animate) row.animate(
      [{ opacity: 0, transform: 'translateY(18px) scale(.97)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: 40 + k * 55, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
}

// 3 · picking a slot splits it in two and slides Confirm out (CSS transitions)
function pickSlot(row) {
  if (phase !== 'pick') return;
  list.querySelectorAll('.is-sel').forEach(r => r !== row && r.classList.remove('is-sel'));
  slot = row.classList.toggle('is-sel') ? row.querySelector('.sb-time').textContent : null;
}

// 4 · confirm: the columns fade while the card folds into the centre
async function book() {
  if (phase !== 'pick' || !slot) return;
  phase = 'busy';
  const [h, m] = slot.split(':').map(Number), end = h * 60 + m + 30, pad = n => String(n).padStart(2, '0');
  root.querySelector('.sb-when-day').textContent = label(day);
  root.querySelector('.sb-when-time').textContent = `${slot}–${pad(end / 60 | 0)}:${pad(end % 60)}`;
  const fold = tween(560, (t, p) => {
    morph(t);
    const q = Math.min(1, p / .4);
    cols.style.opacity = 1 - q;
    cols.style.transform = `scale(${1 - .1 * ease.out(q)})`;
  });
  await wait(330);
  booked.hidden = false;
  [...booked.children].forEach((el, k) => el.animate(
    [{ opacity: 0, transform: k ? 'translateY(16px)' : 'scale(.6)' }, { opacity: 1, transform: 'none' }],
    { duration: 460, delay: k ? 140 + k * 70 : 0, fill: 'backwards',
      easing: k ? 'cubic-bezier(.2,.8,.2,1)' : 'cubic-bezier(.34,1.56,.64,1)' }));
  await tween(440, t => booked.querySelector('.sb-ring').style.strokeDashoffset = 100 - 100 * t);
  await fold;
  cols.style.visibility = 'hidden';

  // 5 · the check draws, the card lights up and an Ion wash floods the page
  box.classList.add('is-won');
  tween(1100, (t, p) => wash.style.opacity = p < .16 ? p / .16 : 1 - .6 * (p - .16) / .84, t => t);
  const check = booked.querySelector('.sb-check');
  await tween(380, t => check.style.strokeDashoffset = 100 - 100 * t, ease.out);
  phase = 'booked';
}

// widget rect ⇄ booked card rect
function morph(t) {
  Object.assign(box.style, {
    left: lerp(0, 270, t) + 'px', top: lerp(0, 20, t) + 'px',
    width: lerp(1100, 560, t) + 'px', height: lerp(640, 600, t) + 'px',
  });
}

// 6 · book another: the card dissolves and unfolds back into the widget
async function again() {
  if (phase !== 'booked') return;
  phase = 'busy';
  const glow = parseFloat(wash.style.opacity) || 0;
  box.classList.remove('is-won');
  tween(420, t => wash.style.opacity = glow * (1 - t), ease.out);
  const fade = tween(240, t => { booked.style.opacity = 1 - t; booked.style.filter = `blur(${10 * t}px)`; }, ease.in);
  await wait(110);
  const unfold = tween(520, t => morph(1 - t));
  await fade;
  booked.hidden = true; booked.style.opacity = booked.style.filter = '';
  booked.querySelectorAll('.sb-ring, .sb-check').forEach(el => el.style.strokeDashoffset = 100);
  booked.querySelector('.sb-add').textContent = 'Add to calendar';
  cells[day].classList.remove('is-sel'); day = 10; slot = null; select(10); showSlots(10, false);
  cols.style.visibility = ''; cols.style.opacity = 1; cols.style.transform = '';
  [...cols.children].forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
    { duration: 420, delay: k * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  await unfold;
  phase = 'pick';
}

// error path: a fully booked day shakes and says so
function fullyBooked(d) {
  if (phase !== 'pick') return;
  cells[d].classList.add('is-err');
  cells[d].animate([{ translate: '0' }, { translate: '-6px' }, { translate: '5px' }, { translate: '-3px' }, { translate: '0' }], 360);
  sub.textContent = `Nov ${d} is fully booked`; sub.classList.add('is-err');
  clearTimeout(fullyBooked.timer);
  fullyBooked.timer = setTimeout(() => {
    cells[d].classList.remove('is-err'); sub.classList.remove('is-err');
    sub.textContent = `${slotsFor(day).length} slots · 30 min`;
  }, 1600);
}

function select(d) { cells[d].classList.add('is-sel'); const [x, y] = at(d); disc.style.transform = `translate(${x}px,${y}px)`; }

root.querySelector('.sb-again').addEventListener('click', again);
root.querySelector('.sb-add').addEventListener('click', e => e.currentTarget.textContent = 'Added ✓');
select(day);
showSlots(day, false);
