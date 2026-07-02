import os

# Generaremos un archivo SVG limpio de la mesa de póker "The Gang" vacía.
# En esta ocasión, removemos por completo los recuadros guía (placeholders) de las 5 cartas comunitarias del centro.
# El centro queda totalmente despejado (tapete verde limpio con degradado y líneas perimetrales).

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a1a" />
      <stop offset="50%" stop-color="#0f0f0f" />
      <stop offset="100%" stop-color="#050505" />
    </linearGradient>

    <linearGradient id="woodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4a2511" />
      <stop offset="50%" stop-color="#2b1408" />
      <stop offset="100%" stop-color="#170a04" />
    </linearGradient>

    <radialGradient id="feltGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
      <stop offset="0%" stop-color="#14522f" />
      <stop offset="70%" stop-color="#0b331d" />
      <stop offset="100%" stop-color="#051c0f" />
    </radialGradient>

    <linearGradient id="leatherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#333333" />
      <stop offset="30%" stop-color="#1a1a1a" />
      <stop offset="80%" stop-color="#0d0d0d" />
      <stop offset="100%" stop-color="#000000" />
    </linearGradient>

    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c5a059" />
      <stop offset="50%" stop-color="#fdf1a9" />
      <stop offset="100%" stop-color="#96712f" />
    </linearGradient>

    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <rect width="1000" height="600" fill="url(#bgGrad)" />
  
  <path d="M0,100 L1000,100 M0,200 L1000,200 M0,300 L1000,300 M0,400 L1000,400 M0,500 L1000,500" stroke="#141414" stroke-width="1" />

  <g transform="translate(0, 0)">
    
    <rect x="90" y="70" width="820" height="460" rx="230" ry="230" fill="url(#leatherGrad)" filter="url(#dropShadow)" />
    
    <rect x="105" y="85" width="790" height="430" rx="215" ry="215" fill="none" stroke="#262626" stroke-width="1.5" stroke-dasharray="6,4" />

    <rect x="120" y="100" width="760" height="400" rx="200" ry="200" fill="url(#woodGrad)" stroke="#110703" stroke-width="2" />

    <rect x="160" y="140" width="680" height="320" rx="160" ry="160" fill="url(#feltGrad)" stroke="#0b2415" stroke-width="3" />

    <rect x="190" y="170" width="620" height="260" rx="130" ry="130" fill="none" stroke="url(#goldGrad)" stroke-width="2" stroke-opacity="0.4" />
    
    <rect x="230" y="210" width="540" height="180" rx="90" ry="90" fill="none" stroke="url(#goldGrad)" stroke-width="1" stroke-opacity="0.25" stroke-dasharray="8,4" />

    <g stroke="url(#goldGrad)" stroke-width="1" fill="none" opacity="0.3">
      <path d="M 210,300 L 225,290 L 225,310 Z" />
      <line x1="225" y1="300" x2="250" y2="300" />
      <circle cx="253" cy="300" r="2" fill="url(#goldGrad)" />
      
      <path d="M 790,300 L 775,290 L 775,310 Z" />
      <line x1="775" y1="300" x2="750" y2="300" />
      <circle cx="747" cy="300" r="2" fill="url(#goldGrad)" />
    </g>

  </g>
</svg>
"""

output_path = "mesa_poker_the_gang_completamente_vacia.svg"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(svg_content)

print(f"Archivo guardado exitosamente en: {output_path}")