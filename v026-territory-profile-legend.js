'use strict';

/* v0.26.0 UX hardening: profile map is categorical, not a risk-intensity scale. */
const v026LegendBaseRender=v022Render;
v022Render=function(){
  v026LegendBaseRender();
  const root=v019Content();if(!root)return;
  if(V022_STATE.layer==='profile'){
    const legend=root.querySelector('.v022-legend');
    if(legend){legend.textContent='Clasificación categórica · no escala 0–100';legend.classList.add('v026-categorical-note');}
    const aside=root.querySelector('.v022-map-layout aside > p');
    if(aside)aside.textContent='Familia explicativa que conduce la composición regional del Score B. La categoría no representa una intensidad adicional ni prueba causalidad.';
  }
  v026ApplyVersion();
};
