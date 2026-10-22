export const palettes = {
  violet: ['#6c4bff', '#b7a4ff', '#f0ecff'],
  ocean: ['#087f8c', '#55d5dc', '#e5f8f8'],
  earth: ['#80533e', '#c69b77', '#f6eee5'],
  coral: ['#d84a63', '#ffa08c', '#fff0ed'],
  night: ['#202841', '#8a94b0', '#eff1f7']
};
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function logoSVG({name = 'روشنا', style = 'minimal', palette = 'violet', variant = 0}, transparent = false) {
  const [ink, accent, paper] = palettes[palette] || palettes.violet;
  const n = Number(variant) % 4;
  const shapes = [
    `<path d="M210 133 256 54 302 133 256 160Z" fill="${ink}"/><path d="m218 143 38 23 38-23-38 65Z" fill="${accent}"/>`,
    `<path d="M256 202C144 158 179 70 225 88c20 8 31 31 31 31s11-23 31-31c46-18 81 70-31 114Z" fill="${ink}"/><path d="M256 180V120m0 41-31-21m31 8 24-21" fill="none" stroke="${paper}" stroke-width="5" stroke-linecap="round"/>`,
    `<circle cx="256" cy="133" r="65" fill="none" stroke="${ink}" stroke-width="13"/><path d="m210 158 38-65 18 36 25-22 12 51Z" fill="${accent}"/>`,
    `<path d="M196 167V91l60 43 60-43v76l-60-35Z" fill="${ink}"/><circle cx="256" cy="81" r="12" fill="${accent}"/>`
  ];
  const decoration = style === 'bold' ? `<rect x="173" y="47" width="166" height="166" rx="44" fill="${accent}" opacity=".14"/>` : style === 'organic' ? `<ellipse cx="256" cy="135" rx="91" ry="78" fill="${accent}" opacity=".16" transform="rotate(-15 256 135)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="720" viewBox="0 0 512 360" role="img" aria-label="${escapeHTML(name)}">${transparent ? '' : `<rect width="512" height="360" rx="24" fill="${paper}"/>`}${decoration}${shapes[n]}<text x="256" y="278" text-anchor="middle" direction="rtl" font-family="Vazirmatn,Tahoma,Arial,sans-serif" font-size="${name.length > 16 ? 25 : 38}" font-weight="800" fill="${ink}">${escapeHTML(name)}</text><path d="M236 306h40" stroke="${accent}" stroke-width="3" stroke-linecap="round"/></svg>`;
}
