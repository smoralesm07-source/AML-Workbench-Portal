(function atlasMobileNavigation(){
  'use strict';

  const BREAKPOINT=768;
  const RADAR_VIEWS=new Set(['sujetos-obligados','sanctions','public-spend','osfl']);
  const MORE_VIEWS=new Set(['questions']);
  const ICONS={
    radar:'<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    entity:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    territory:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    radars:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4v2M20 12h-2M12 20v-2M4 12h2"/>',
    more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    sanctions:'<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5h.01"/>',
    obligated:'<path d="M12 2.6 4.5 5.4v6.2c0 4.4 3.1 8.4 7.5 9.8 4.4-1.4 7.5-5.4 7.5-9.8V5.4L12 2.6Z"/><path d="M9 10.5h6M9 13.8h4"/>',
    spend:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.5 7.6l4.3 8M17.5 7.6l-4.3 8"/>',
    osfl:'<circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m11 6.8-5 9.4M13 6.8l5 9.4M7 18h10"/>',
    questions:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9.5a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.1.8-1.1 1.6v.5M12 17.5h.01"/>',
    theme:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    logout:'<path d="M10 5H5v14h5"/><path d="M13 8l4 4-4 4M17 12H8"/>'
  };

  const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]||ICONS.radar}</svg>`;
  const isMobile=()=>window.matchMedia(`(max-width:${BREAKPOINT-0.02}px)`).matches;
  const activeDesktopView=()=>document.querySelector('.v019-nav .v019-nav-btn.active[data-view],.v019-nav .atlas-nav-btn.active[data-view]')?.dataset.view||null;

  let selectedView='overview';
  let shellWrapperInstalled=false;
  let navigateWrapperInstalled=false;
  let scheduled=false;

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;ensure();});
  }

  function installWrappers(){
    if(!shellWrapperInstalled&&typeof window.shell==='function'&&!window.shell.__atlasMobileNavWrapped){
      const baseShell=window.shell;
      const wrapped=function(...args){
        const result=baseShell.apply(this,args);
        schedule();
        return result;
      };
      wrapped.__atlasMobileNavWrapped=true;
      window.shell=wrapped;
      shellWrapperInstalled=true;
    }
    if(!navigateWrapperInstalled&&typeof window.navigate==='function'&&!window.navigate.__atlasMobileNavWrapped){
      const baseNavigate=window.navigate;
      const wrapped=async function(...args){
        const requested=String(args[0]||'');
        if(requested)selectedView=requested;
        try{return await baseNavigate.apply(this,args);}
        finally{schedule();}
      };
      wrapped.__atlasMobileNavWrapped=true;
      window.navigate=wrapped;
      navigateWrapperInstalled=true;
    }
  }

  function navMarkup(){
    return `<nav class="atlas-mobile-nav" id="atlas-mobile-nav" aria-label="Navegación principal de Atlas">
      ${tab('overview','Radar','radar')}
      ${tab('entities','Entidades','entity')}
      ${tab('territory','Territorio','territory')}
      ${menuTab('radars','Radares','radars')}
      ${menuTab('more','Más','more')}
    </nav>
    <div class="atlas-mobile-sheet-backdrop" id="atlas-mobile-sheet-backdrop" aria-hidden="true">
      <section class="atlas-mobile-sheet" id="atlas-mobile-sheet" role="dialog" aria-modal="true" aria-label="Menú móvil de Atlas">
        <div class="atlas-mobile-sheet-handle" aria-hidden="true"></div>
        <div id="atlas-mobile-sheet-content"></div>
      </section>
    </div>`;
  }

  function tab(view,label,icon){
    return `<button type="button" class="atlas-mobile-tab" data-atlas-mobile-view="${view}" aria-label="${label}">
      <span class="atlas-mobile-tab-icon">${svg(icon)}</span><span class="atlas-mobile-tab-label">${label}</span>
    </button>`;
  }

  function menuTab(menu,label,icon){
    return `<button type="button" class="atlas-mobile-tab" data-atlas-mobile-menu="${menu}" aria-haspopup="dialog" aria-expanded="false" aria-label="${label}">
      <span class="atlas-mobile-tab-icon">${svg(icon)}</span><span class="atlas-mobile-tab-label">${label}</span>
    </button>`;
  }

  function sheetItem({view,action,label,sub,icon}){
    const attr=view?`data-atlas-mobile-view="${view}"`:`data-atlas-mobile-action="${action}"`;
    const active=view&&selectedView===view?' is-active':'';
    return `<button type="button" class="atlas-mobile-sheet-item${active}" ${attr}>
      <span class="atlas-mobile-sheet-item-icon">${svg(icon)}</span>
      <span class="atlas-mobile-sheet-item-copy"><b>${label}</b><span>${sub}</span></span>
      <span class="atlas-mobile-sheet-item-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function renderSheet(kind){
    const host=document.querySelector('#atlas-mobile-sheet-content');
    if(!host)return;
    if(kind==='radars'){
      host.innerHTML=`<div class="atlas-mobile-sheet-head"><strong>Radares</strong><button type="button" class="atlas-mobile-sheet-close" data-atlas-mobile-close aria-label="Cerrar">×</button></div>
        <div class="atlas-mobile-sheet-list">
          ${sheetItem({view:'sujetos-obligados',label:'Sujetos Obligados',sub:'Padrón UAF y prioridad fiscalizadora',icon:'obligated'})}
          ${sheetItem({view:'sanctions',label:'Sanciones',sub:'Eventos y señales sancionatorias',icon:'sanctions'})}
          ${sheetItem({view:'public-spend',label:'Gasto público',sub:'Presupuesto abierto y proveedores',icon:'spend'})}
          ${sheetItem({view:'osfl',label:'OSFL',sub:'Organizaciones sin fines de lucro',icon:'osfl'})}
        </div>`;
    }else{
      host.innerHTML=`<div class="atlas-mobile-sheet-head"><strong>Más opciones</strong><button type="button" class="atlas-mobile-sheet-close" data-atlas-mobile-close aria-label="Cerrar">×</button></div>
        <div class="atlas-mobile-sheet-list">
          ${sheetItem({view:'questions',label:'Preguntas',sub:'Entrada a análisis y consultas',icon:'questions'})}
        </div>
        <div class="atlas-mobile-sheet-separator"></div>
        <div class="atlas-mobile-sheet-list">
          ${sheetItem({action:'theme',label:'Cambiar tema',sub:'Alternar entre modo claro y oscuro',icon:'theme'})}
          ${sheetItem({action:'logout',label:'Cerrar sesión',sub:'Finalizar la sesión segura de Atlas',icon:'logout'})}
        </div>`;
    }
  }

  function openSheet(kind){
    if(!isMobile())return;
    renderSheet(kind);
    const backdrop=document.querySelector('#atlas-mobile-sheet-backdrop');
    if(!backdrop)return;
    backdrop.dataset.menu=kind;
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden','false');
    document.body.classList.add('atlas-mobile-sheet-open');
    document.querySelectorAll('[data-atlas-mobile-menu]').forEach(btn=>btn.setAttribute('aria-expanded',String(btn.dataset.atlasMobileMenu===kind)));
    syncActive();
    requestAnimationFrame(()=>document.querySelector('#atlas-mobile-sheet .atlas-mobile-sheet-close')?.focus({preventScroll:true}));
  }

  function closeSheet(){
    const backdrop=document.querySelector('#atlas-mobile-sheet-backdrop');
    if(!backdrop)return;
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden','true');
    backdrop.removeAttribute('data-menu');
    document.body.classList.remove('atlas-mobile-sheet-open');
    document.querySelectorAll('[data-atlas-mobile-menu]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
  }

  function go(view){
    selectedView=view;
    closeSheet();
    syncActive();
    const desktop=document.querySelector(`.v019-nav [data-view="${view}"]`);
    if(desktop){
      desktop.click();
      schedule();
      return;
    }
    if(typeof window.navigate==='function'){
      Promise.resolve(window.navigate(view)).finally(schedule);
    }
  }

  function performAction(action){
    if(action==='theme'){
      if(window.AtlasTheme?.toggle)window.AtlasTheme.toggle();
      else document.querySelector('.atlas-theme-toggle')?.click();
      closeSheet();
      return;
    }
    if(action==='logout'){
      closeSheet();
      const logout=document.querySelector('#v019-logout,#logout,.v019-side-foot [data-action="logout"]');
      logout?.click();
    }
  }

  function syncActive(){
    const desktop=activeDesktopView();
    if(desktop)selectedView=desktop;
    document.querySelectorAll('.atlas-mobile-tab').forEach(btn=>{
      const view=btn.dataset.atlasMobileView;
      const menu=btn.dataset.atlasMobileMenu;
      const active=view?selectedView===view:menu==='radars'?RADAR_VIEWS.has(selectedView):menu==='more'?MORE_VIEWS.has(selectedView):false;
      btn.classList.toggle('is-active',active);
      if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
    });
    document.querySelectorAll('.atlas-mobile-sheet-item[data-atlas-mobile-view]').forEach(btn=>{
      btn.classList.toggle('is-active',btn.dataset.atlasMobileView===selectedView);
    });
  }

  function bind(root){
    root.addEventListener('click',event=>{
      const viewButton=event.target.closest('[data-atlas-mobile-view]');
      if(viewButton){event.preventDefault();go(viewButton.dataset.atlasMobileView);return;}
      const menuButton=event.target.closest('[data-atlas-mobile-menu]');
      if(menuButton){event.preventDefault();openSheet(menuButton.dataset.atlasMobileMenu);return;}
      const actionButton=event.target.closest('[data-atlas-mobile-action]');
      if(actionButton){event.preventDefault();performAction(actionButton.dataset.atlasMobileAction);return;}
      if(event.target.closest('[data-atlas-mobile-close]')){event.preventDefault();closeSheet();}
    });
  }

  function ensure(){
    installWrappers();
    const shell=document.querySelector('.v019-shell');
    const existing=document.querySelector('#atlas-mobile-nav');
    if(!shell){
      document.querySelector('#atlas-mobile-navigation-root')?.remove();
      document.body.classList.remove('atlas-mobile-sheet-open');
      return false;
    }
    if(!existing){
      const host=document.createElement('div');
      host.id='atlas-mobile-navigation-root';
      host.innerHTML=navMarkup();
      document.body.appendChild(host);
      bind(host);
      const backdrop=host.querySelector('#atlas-mobile-sheet-backdrop');
      backdrop?.addEventListener('click',event=>{if(event.target===backdrop)closeSheet();});
    }
    syncActive();
    if(!isMobile())closeSheet();
    window.__ATLAS_MOBILE_NAV_HEALTH__={
      status:'ready',
      breakpoint:BREAKPOINT,
      currentView:selectedView,
      desktopSidebarPreserved:true,
      routeReuse:true,
      checkedAt:new Date().toISOString()
    };
    return true;
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('.v019-nav [data-view]'))schedule();
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSheet();});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule);
  window.addEventListener('atlas:nav-refresh',schedule);
  window.addEventListener('atlas:themechange',schedule);

  window.AtlasMobileNav={refresh:ensure,openRadares:()=>openSheet('radars'),openMore:()=>openSheet('more'),close:closeSheet,go};
  installWrappers();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  for(const ms of [80,260,700,1500])setTimeout(schedule,ms);
})();