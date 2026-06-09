
(() => {
  const DEFAULT_STATE = {
    route: "inicio",
    session: null,
    profile: null,
    visual: { panelScale:1, mediaScale:1, fontScale:1, reducedMotion:false, backgroundUrl:"", backgroundOpacity:8, backgroundLoop:true },
    banners: [{ id:"banner-1", title:"Dream Team de Calidad", subtitle:"Calidad · Mejora Continua · Auditoría", description:"Portal institucional para centralizar Apps, documentos, noticias, auditorías y publicaciones.", button_text:"Explorar portal", link_url:"#/apps", media_url:"assets/home/banner-placeholder.svg", animation:"fade", is_active:true, sort_order:1 }],
    mascot: [
      { id:"mascot-1", name:"Nuestra mascota", description:"Espacio para mostrar hasta 15 imágenes, GIFs o videos de la mascota.", media_url:"assets/mascot/mascot-placeholder.svg", is_active:true, sort_order:1 }
    ],
    team: [{ id:"team-1", name:"Equipo de Calidad", role:"Calidad y mejora continua", bio:"Tarjeta editable para presentar integrantes del equipo.", photo_url:"assets/team/team-placeholder.svg", is_active:true, sort_order:1 }],
    modulePanels: {
      apps:{badge:"Gen-4 Turbo",title:"Gen-4 Turbo - Animar",description:"Visual principal del ecosistema de Apps.",mediaUrl:"assets/module-media/gen4-apps.png",panelScale:100,mediaScale:100},
      news:{badge:"Gen-4 Turbo",title:"Gen-4 Turbo - Animar con movimientos fluidos",description:"Panel visual dinámico para noticias.",mediaUrl:"assets/module-media/gen4-news.mp4",panelScale:100,mediaScale:100},
      audits:{badge:"Gen-4 Turbo",title:"Gen-4 Turbo - Debe estar auditando",description:"Visual principal del módulo de auditoría.",mediaUrl:"assets/module-media/gen4-audits.mp4",panelScale:100,mediaScale:100},
      documents:{badge:"Gen-4 Turbo",title:"Gen-4 Turbo - Libro moviendo hojas y el sonriendo",description:"Representación visual del módulo documental.",mediaUrl:"assets/module-media/gen4-documents.mp4",panelScale:100,mediaScale:100},
      publications:{badge:"Gen-4 Turbo",title:"Gen-4 Turbo - Debe estar escribiendo en el teclado",description:"Visual protagonista para publicaciones internas.",mediaUrl:"assets/module-media/gen4-publications.mp4",panelScale:100,mediaScale:100}
    }
  };

  const STORAGE_KEY = "dream_clean_v6_stable_state";
  const HOME_SETTING_KEY = "portal_home_settings_v6";
  const ASSETS = [
    ["assets/module-media/gen4-apps.png","Gen-4 Turbo · Apps"],
    ["assets/module-media/gen4-news.mp4","Gen-4 Turbo · Noticias"],
    ["assets/module-media/gen4-audits.mp4","Gen-4 Turbo · Auditoría"],
    ["assets/module-media/gen4-documents.mp4","Gen-4 Turbo · Documentos"],
    ["assets/module-media/gen4-publications.mp4","Gen-4 Turbo · Publicaciones"],
    ["assets/notifications/app.gif","Sticker · App"],
    ["assets/notifications/news.gif","Sticker · Noticia"],
    ["assets/notifications/document.gif","Sticker · Documento"],
    ["assets/notifications/audit.gif","Sticker · Auditoría"],
    ["assets/notifications/publication.gif","Sticker · Publicación"],
    ["assets/home/banner-placeholder.svg","Banner base"],
    ["assets/mascot/mascot-placeholder.svg","Mascota base"],
    ["assets/team/team-placeholder.svg","Equipo base"]
  ].map(([value,label])=>({value,label}));

  const DEMO = {
    app_modules: [],
    news_posts: [],
    audit_reports: [],
    documents: [],
    publications: []
  };

  const TYPE_ASSETS = {
    app_modules:{gif:"assets/notifications/app.gif",sound:"assets/notifications/action-notification.mp3",label:"Nueva App publicada"},
    news_posts:{gif:"assets/notifications/news.gif",sound:"assets/notifications/action-notification.mp3",label:"Nueva noticia publicada"},
    audit_reports:{gif:"assets/notifications/audit.gif",sound:"assets/notifications/action-notification.mp3",label:"Nueva auditoría publicada"},
    documents:{gif:"assets/notifications/document.gif",sound:"assets/notifications/action-notification.mp3",label:"Nuevo documento disponible"},
    publications:{gif:"assets/notifications/publication.gif",sound:"assets/notifications/action-notification.mp3",label:"Nueva publicación interna"},
    general:{gif:"assets/notifications/loading.gif",sound:"assets/notifications/new-notification.mp3",label:"Actualización del portal"}
  };

  let state = loadState();
  let supabaseClient = null;
  let bannerTimer = null;
  let mascotTimer = null;

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function merge(base, patch){
    const out=clone(base);
    for(const [k,v] of Object.entries(patch||{})){
      if(v && typeof v==="object" && !Array.isArray(v) && out[k] && typeof out[k]==="object") out[k]=merge(out[k],v);
      else out[k]=v;
    }
    return out;
  }
  function loadState(){try{return merge(DEFAULT_STATE,JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"));}catch{return clone(DEFAULT_STATE);}}
  function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({visual:state.visual,banners:state.banners,mascot:state.mascot,team:state.team,modulePanels:state.modulePanels,profile:state.profile}));}
  function $(s,r=document){return r.querySelector(s);} function $$(s,r=document){return [...r.querySelectorAll(s)];}
  function esc(v=""){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
  function slugify(v="registro"){return String(v||"registro").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "registro";}
  function routeName(){return (location.hash.replace(/^#\/?/,"")||"inicio").split("?")[0];}
  function params(){return new URLSearchParams((location.hash.split("?")[1]||""));}
  function isVideo(url=""){return /\.(mp4|webm|ogg)(\?|$)/i.test(String(url));}
  function mediaHTML(url, alt="Visual"){
    if(!url) return "";
    const safe=esc(url);
    return isVideo(url) ? `<video src="${safe}" autoplay muted loop playsinline preload="metadata" aria-label="${esc(alt)}"></video>` : `<img src="${safe}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  }

  async function initSupabase(){
    const cfg=window.DREAM_CONFIG||{};
    if(!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;
    supabaseClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const {data}=await supabaseClient.auth.getSession();
    state.session=data?.session||null;
    if(state.session?.user) await loadProfile();
    await loadHomeSettings();
    supabaseClient.auth.onAuthStateChange(async(_,session)=>{state.session=session;if(session?.user) await loadProfile(); else state.profile=null;renderAuth();});
  }
  async function loadProfile(){
    if(!supabaseClient || !state.session?.user) return;
    const email=state.session.user.email;
    try{
      const {data}=await supabaseClient.from("profiles").select("*").eq("email",email).maybeSingle();
      state.profile=data||{email,full_name:email,role:email?.toLowerCase()===(window.DREAM_CONFIG?.superAdminEmail||"").toLowerCase()?"super_admin":"solicitante",is_active:true};
    }catch{
      state.profile={email,role:email?.toLowerCase()===(window.DREAM_CONFIG?.superAdminEmail||"").toLowerCase()?"super_admin":"solicitante",is_active:true};
    }
  }
  async function loadHomeSettings(){
    if(!supabaseClient) return false;

    const applyRemoteSettings = (payload) => {
      if(!payload || typeof payload !== "object") return false;
      state = merge(state, payload);
      saveState();
      applyVisual();
      console.info("[DreamTeam] Configuración cargada desde Supabase:", HOME_SETTING_KEY);
      return true;
    };

    try{
      const { data, error } = await supabaseClient.rpc("portal_get_home_settings");
      if(!error && data){
        return applyRemoteSettings(data);
      }
      if(error){
        console.warn("RPC portal_get_home_settings falló:", error.message || error);
      }
    }catch(err){
      console.warn("No se pudo leer por RPC portal_get_home_settings:", err?.message || err);
    }

    try{
      const { data, error } = await supabaseClient
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", HOME_SETTING_KEY)
        .maybeSingle();

      if(!error && data?.setting_value){
        return applyRemoteSettings(data.setting_value);
      }

      if(error){
        console.warn("No se pudo leer system_settings:", error.message || error);
      }
    }catch(err){
      console.warn("No se pudo leer system_settings:", err?.message || err);
    }

    return false;
  }

  async function saveHomeSettings(){
    saveState();

    if(!supabaseClient){
      toast("No se guardó en Supabase", "No hay conexión con Supabase. El cambio solo quedó en este navegador.", {
        gif:"assets/notifications/loading.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return false;
    }

    if(!canManageContent()){
      toast("Sin permisos", "Este usuario no tiene permisos para guardar cambios globales.", {
        gif:"assets/notifications/loading.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return false;
    }

    const payload = {
      visual: state.visual,
      banners: state.banners,
      mascot: state.mascot,
      team: state.team,
      modulePanels: state.modulePanels
    };

    try{
      const { error } = await supabaseClient.rpc("portal_save_home_settings", {
        payload
      });

      if(!error){
        console.info("[DreamTeam] Configuración guardada en Supabase por RPC:", HOME_SETTING_KEY);
        return true;
      }

      console.warn("RPC portal_save_home_settings falló:", error.message || error);
      toast("No se guardó en Supabase", error.message || "La función RPC rechazó el guardado.", {
        gif:"assets/notifications/loading.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return false;
    }catch(err){
      console.warn("No se pudo guardar por RPC portal_save_home_settings:", err?.message || err);
      toast("No se guardó en Supabase", err?.message || "El cambio solo quedó en este navegador.", {
        gif:"assets/notifications/loading.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return false;
    }
  }

  function isSuperAdmin(){
    const email=state.profile?.email||state.session?.user?.email||"";
    return state.profile?.role==="super_admin" || email.toLowerCase()===(window.DREAM_CONFIG?.superAdminEmail||"").toLowerCase();
  }
  function isAdmin(){
    return state.profile?.role === "admin";
  }
  function canManageContent(){
    return isSuperAdmin() || isAdmin();
  }
  function getRole(){return isSuperAdmin()?"super_admin":(state.profile?.role||"visitante");}

  async function list(table){
    const remote=await safeSelect(table);
    if(remote.length) return remote;
    return DEMO[table]||[];
  }
  async function safeSelect(table){
    if(!supabaseClient) return [];
    const attempts=[
      () => supabaseClient.from(table).select("*").limit(200),
      () => supabaseClient.from(table).select("*")
    ];
    for(const run of attempts){
      try{
        const {data,error}=await run();
        if(!error && Array.isArray(data)) return data;
        if(error) console.warn("Select falló",table,error.message||error);
      }catch(err){console.warn("Select error",table,err?.message||err);}
    }
    return [];
  }
  async function upsert(table,payload){
    payload.id=payload.id||crypto.randomUUID();
    payload.updated_at=new Date().toISOString();
    payload.slug=payload.slug || slugify(payload.title||payload.name||"registro")+"-"+String(payload.id).slice(0,8);
    if(supabaseClient){
      try{
        const {data,error}=await supabaseClient.from(table).upsert(payload).select().maybeSingle();
        if(!error) return data||payload;
        console.warn("Upsert falló",table,error.message||error);
        toast("No se pudo guardar en Supabase","Revisa las columnas obligatorias de esa tabla.",{gif:"assets/notifications/loading.gif?v=v10-loader"});
      }catch(err){console.warn("Upsert error",table,err?.message||err);}
    }
    DEMO[table]=DEMO[table]||[];
    const idx=DEMO[table].findIndex(x=>x.id===payload.id);
    if(idx>=0) DEMO[table][idx]=payload; else DEMO[table].unshift(payload);
    return payload;
  }

  async function deleteRecord(table, id){
    if(!id) return false;

    if(["banners","mascot","team"].includes(table)){
      state[table] = (state[table] || []).filter(x => String(x.id) !== String(id));
      await saveHomeSettings();
      toast("Eliminado", "El registro fue eliminado correctamente.", {
        gif:"assets/notifications/success.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return true;
    }

    if(supabaseClient){
      try{
        const { error } = await supabaseClient.from(table).delete().eq("id", id);
        if(!error){
          toast("Eliminado", "El registro fue eliminado correctamente.", {
            gif:"assets/notifications/success.gif",
            sound:"assets/notifications/new-notification.mp3"
          });
          return true;
        }
        console.warn("Delete falló", table, error.message || error);
        toast("No se pudo eliminar", error.message || "Supabase no permitió eliminar el registro.", {
          gif:"assets/notifications/loading.gif?v=v10-loader"
        });
        return false;
      }catch(err){
        console.warn("Delete error", table, err?.message || err);
        toast("Error al eliminar", err?.message || "No se pudo eliminar el registro.", {
          gif:"assets/notifications/loading.gif?v=v10-loader"
        });
        return false;
      }
    }

    DEMO[table] = (DEMO[table] || []).filter(x => String(x.id) !== String(id));
    toast("Eliminado", "El registro fue eliminado en modo local.", {
      gif:"assets/notifications/success.gif"
    });
    return true;
  }

  async function insertCompliment(payload){
    payload.id=crypto.randomUUID();
    payload.created_at=new Date().toISOString();
    try{ if(supabaseClient) await supabaseClient.from("compliments").insert(payload); }catch{}
    toast("Gracias por tu mensaje","Tu calificación o elogio fue recibido.",{gif:"assets/notifications/success.gif",sound:"assets/notifications/new-notification.mp3"});
  }

  function playSound(src){try{const a=new Audio(src);a.volume=.62;a.play().catch(()=>{});}catch{}}
  function toast(title,msg="",opts={}){
    const zone=$("#toast-zone"); if(!zone) return;
    const el=document.createElement("div"); el.className="toast";
    el.innerHTML=`<img src="${esc(opts.gif||TYPE_ASSETS.general.gif)}" alt=""><div><strong>${esc(title)}</strong>${msg?`<p>${esc(msg)}</p>`:""}</div>`;
    zone.appendChild(el); if(opts.sound) playSound(opts.sound); setTimeout(()=>el.remove(),opts.duration||5200);
  }
  function loading(show=true,text="Cargando..."){const o=$("#loading-overlay"); if(!o)return; o.hidden=!show; $("#loading-text").textContent=text;}
  async function withLoading(text,fn){loading(true,text);try{return await fn();}finally{loading(false);toast("Listo","La acción finalizó correctamente.",{gif:"assets/notifications/success.gif",sound:"assets/notifications/new-notification.mp3",duration:3200});}}

  async function uploadAsset(file,moduleKey="general"){
    if(!file) return "";

    if((file.type||"").startsWith("video/") && file.size > 20*1024*1024 && moduleKey === "background"){
      toast("Archivo muy pesado","El fondo animado no debe superar 20 MB.",{
        gif:"assets/notifications/loading.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return "";
    }

    if(!supabaseClient){
      toast("No se subió la imagen","No hay conexión con Supabase. El archivo no se puede compartir entre dispositivos.",{
        gif:"assets/notifications/loading.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return "";
    }

    const sessionResp = await supabaseClient.auth.getSession().catch(() => null);
    const activeSession = state.session || sessionResp?.data?.session;

    if(!activeSession?.user){
      toast("Debes iniciar sesión","Para que la imagen quede visible para todos, primero inicia sesión.",{
        gif:"assets/notifications/loading.gif",
        sound:"assets/notifications/new-notification.mp3"
      });
      return "";
    }

    return await withLoading("Subiendo archivo a Supabase...", async()=>{
      try{
        const originalName = file.name || "archivo";
        const cleanName = originalName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g,"")
          .replace(/[^a-zA-Z0-9._-]+/g,"-")
          .replace(/^-+|-+$/g,"") || "archivo";

        const safeModule = String(moduleKey || "general")
          .replace(/[^a-zA-Z0-9._-]+/g,"-");

        const path = `${safeModule}/${Date.now()}-${crypto.randomUUID()}-${cleanName}`;

        const { error } = await supabaseClient.storage
          .from("portal-assets")
          .upload(path, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600"
          });

        if(error){
          console.warn("Storage falló:", error.message || error);
          toast("Storage no aceptó el archivo", error.message || "Revisa el bucket portal-assets y sus políticas.", {
            gif:"assets/notifications/loading.gif",
            sound:"assets/notifications/new-notification.mp3"
          });
          return "";
        }

        const { data } = supabaseClient.storage
          .from("portal-assets")
          .getPublicUrl(path);

        if(!data?.publicUrl){
          toast("No se generó URL pública","El archivo subió, pero Supabase no entregó URL pública.",{
            gif:"assets/notifications/loading.gif",
            sound:"assets/notifications/new-notification.mp3"
          });
          return "";
        }

        console.info("[DreamTeam] Archivo guardado en Supabase Storage:", data.publicUrl);
        return data.publicUrl;
      }catch(err){
        console.warn("Error subiendo archivo:", err?.message || err);
        toast("Error subiendo archivo", err?.message || "No se pudo subir a Supabase Storage.", {
          gif:"assets/notifications/loading.gif",
          sound:"assets/notifications/new-notification.mp3"
        });
        return "";
      }
    });
  }

  function applyVisual(){
    document.documentElement.style.setProperty("--panel-scale",String(state.visual.panelScale||1));
    document.documentElement.style.setProperty("--media-scale",String(state.visual.mediaScale||1));
    document.documentElement.style.setProperty("--font-scale",String(state.visual.fontScale||1));
    document.documentElement.style.setProperty("--bg-opacity",String((Number(state.visual.backgroundOpacity||8))/100));
    document.body.classList.toggle("no-motion",Boolean(state.visual.reducedMotion));
    const bg=$("#custom-bg"); if(bg){const url=state.visual.backgroundUrl||"";bg.innerHTML=url?(isVideo(url)?`<video src="${esc(url)}" ${state.visual.backgroundLoop!==false?"loop":""} autoplay muted playsinline preload="metadata"></video>`:`<img src="${esc(url)}" alt="">`):"";}
    saveState();
  }

  function setRoute(route){state.route=route||routeName();$$(".nav a").forEach(a=>a.classList.toggle("active",a.dataset.route===state.route));}
  function panelHTML(key){
    const p=state.modulePanels[key]||state.modulePanels.apps;
    return `<aside class="panel-blue" style="--panel-scale:${(Number(p.panelScale||100)/100)||1};--media-scale:${(Number(p.mediaScale||100)/100)||1}"><div class="text"><span class="badge">${esc(p.badge||"Gen-4 Turbo")}</span><strong>${esc(p.title||"Panel visual")}</strong><p>${esc(p.description||"")}</p></div><div class="media-frame">${mediaHTML(p.mediaUrl,p.title)}</div></aside>`;
  }
  function moduleHero(key,kicker,title,description,actions=""){
    return `<section class="section reveal"><div class="container"><div class="module-hero"><div class="module-hero-content"><span class="kicker">${esc(kicker)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p><div class="actions">${actions}${isSuperAdmin()?`<button class="btn secondary" data-edit-panel="${key}">✦ Editar visual</button>`:""}<a class="btn secondary" href="#/inicio">Ir al home</a></div></div>${panelHTML(key)}</div><div id="module-content"></div></div></section>`;
  }

  function bannerSummaryHTML(b={}){
    return `<div class="banner-summary-inner"><div class="banner-summary-text"><h2>${esc(b.title||"")}</h2>${b.subtitle?`<p class="banner-summary-subtitle">${esc(b.subtitle)}</p>`:""}${b.description?`<p class="banner-summary-description">${esc(b.description)}</p>`:""}</div>${b.link_url?`<div class="banner-summary-actions"><a class="btn" href="${esc(b.link_url)}">${esc(b.button_text||"Abrir")}</a></div>`:""}</div>`;
  }
  function bannerHTML(){
    const banners=(state.banners||[]).filter(b=>b.is_active!==false).slice(0,15);
    return `<section class="portal-banner" aria-label="Banner principal"><div class="banner-stage" id="banner-stage">${banners.map((b,i)=>`<article class="banner-slide ${i===0?"active":""}" data-index="${i}" data-animation="${esc(b.animation||"fade")}"><div class="banner-media">${mediaHTML(b.media_url,b.title)}</div></article>`).join("")}<div class="banner-controls"><button id="banner-prev" type="button">‹</button><button id="banner-next" type="button">›</button></div><div class="banner-dots">${banners.map((_,i)=>`<button type="button" data-banner-dot="${i}" class="${i===0?"active":""}"></button>`).join("")}</div></div><div class="banner-summary" id="banner-summary">${bannerSummaryHTML(banners[0]||{})}</div></section>`;
  }
  function bindBanner(){
    clearInterval(bannerTimer);
    const slides=$$(".banner-slide"),dots=$$("[data-banner-dot]"),summary=$("#banner-summary"),banners=(state.banners||[]).filter(b=>b.is_active!==false).slice(0,15);
    if(!slides.length)return; let idx=0;
    const show=n=>{idx=(n+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle("active",i===idx));dots.forEach((d,i)=>d.classList.toggle("active",i===idx));if(summary)summary.innerHTML=bannerSummaryHTML(banners[idx]||{});playVisibleVideos();};
    $("#banner-prev")?.addEventListener("click",()=>show(idx-1));$("#banner-next")?.addEventListener("click",()=>show(idx+1));dots.forEach(d=>d.addEventListener("click",()=>show(Number(d.dataset.bannerDot))));bannerTimer=setInterval(()=>show(idx+1),15000);
  }

  async function renderHome(){
    const [apps,news,audits,docs,pubs]=await Promise.all([list("app_modules"),list("news_posts"),list("audit_reports"),list("documents"),list("publications")]);
    const mascot=(state.mascot||[]).filter(x=>x.is_active!==false).slice(0,15);
    const team=state.team||[];
    $("#app").innerHTML=`<section class="container reveal">${bannerHTML()}<div class="hero"><div class="hero-grid"><div><span class="kicker">Calidad y mejoramiento continuo</span><h1>Dream Team de Calidad</h1><p>Portal institucional para centralizar Apps, noticias, auditorías, documentos, publicaciones, equipo y cultura de mejora continua.</p><div class="actions"><a class="btn" href="#/apps">Entrar a Apps</a><a class="btn secondary" href="#/documentos">Ver documentos</a><a class="btn secondary" href="#/admin">Administrar</a></div></div><div class="featured-box"><h3>Resumen del portal</h3><p>Accesos, documentos vigentes, noticias recientes y comunicaciones internas.</p><div class="summary-grid" style="grid-template-columns:repeat(2,1fr)"><article class="summary-card"><strong>${apps.length}</strong><span>Apps disponibles</span></article><article class="summary-card"><strong>${docs.length}</strong><span>Documentos</span></article><article class="summary-card"><strong>${news.length}</strong><span>Noticias</span></article><article class="summary-card"><strong>${pubs.length}</strong><span>Publicaciones</span></article></div></div></div></div><section class="section"><span class="kicker">Destacado</span><h2>Lo más reciente</h2><div class="featured-strip"><article class="featured-box"><h3>${esc(news[0]?.title||"Noticias de calidad")}</h3><p>${esc(news[0]?.description||"Aún no se ha subido nada.")}</p><a class="btn secondary" href="#/noticias">Ver noticias</a></article><article class="featured-box"><h3>${esc(docs[0]?.title||"Documentos institucionales")}</h3><p>${esc(docs[0]?.description||"Aún no se ha subido nada.")}</p><a class="btn secondary" href="#/documentos">Ver documentos</a></article></div></section><section class="section"><span class="kicker">Identidad del equipo</span><h2>Nuestra mascota</h2><div class="mascot-card"><div><h3>${esc(mascot[0]?.name||"Nuestra mascota")}</h3><p>${esc(mascot[0]?.description||"Carrusel de imágenes, GIFs o videos de la mascota.")}</p></div><div class="mascot-media" id="mascot-carousel">${mascot.map((m,i)=>`<div class="mascot-slide ${i===0?"active":""}">${mediaHTML(m.media_url,m.name)}</div>`).join("")}</div></div></section><section class="section"><span class="kicker">Personas</span><h2>Nuestro equipo</h2><p>Conoce al equipo de Calidad, Mejora Continua y Auditoría. También puedes dejarnos una calificación o elogio.</p><div class="grid cols-3">${team.length?team.map(teamCard).join(""):emptyState("integrantes del equipo")}</div></section></section>`;
    bindBanner();bindMascot();bindTeamCards();
  }
  function bindMascot(){
    clearInterval(mascotTimer);
    const slides=$$(".mascot-slide"); if(slides.length<2)return; let idx=0;
    mascotTimer=setInterval(()=>{idx=(idx+1)%slides.length;slides.forEach((s,i)=>s.classList.toggle("active",i===idx));playVisibleVideos();},5000);
  }
  function teamCard(x){return `<article class="card team-card" data-team-id="${esc(x.id)}"><img class="team-photo" src="${esc(x.photo_url||"assets/team/team-placeholder.svg")}" alt="${esc(x.name||"Integrante")}"><h3>${esc(x.name||"Integrante")}</h3><p><strong>${esc(x.role||"Equipo")}</strong></p><p>${esc(x.bio||"")}</p><button class="btn secondary" type="button">Conocer y calificar</button></article>`;}
  function bindTeamCards(){ $$(".team-card").forEach(c=>c.addEventListener("click",()=>{const m=(state.team||[]).find(x=>x.id===c.dataset.teamId);if(m)openTeamModal(m);}));}
  function openTeamModal(member){
    const modal = $("#modal");
    const photo = member.photo_url || "assets/team/team-placeholder.svg";
    modal.innerHTML = `
      <div class="modal-card team-modal-card">
        <div class="team-modal-layout">
          <aside class="team-modal-media">
            <img src="${esc(photo)}" alt="${esc(member.name || "Integrante del equipo")}" loading="eager">
          </aside>
          <section class="team-modal-content">
            <span class="kicker">Presentación del equipo</span>
            <h2>${esc(member.name || "Integrante")}</h2>
            <p class="team-modal-role"><strong>${esc(member.role || "Equipo")}</strong></p>
            <p class="team-modal-bio">${esc(member.bio || "")}</p>
            <label>
              <span>Tu calificación</span>
              <div class="rating-row" id="rating-row">
                ${[1,2,3,4,5].map(i=>`<span data-star="${i}">⭐</span>`).join("")}
              </div>
            </label>
            <label>
              <span>Déjanos un elogio o comentario</span>
              <textarea id="compliment-text" rows="4" placeholder="Escribe un reconocimiento para este integrante..."></textarea>
            </label>
            <div class="actions">
              <button class="btn" id="send-compliment">Enviar</button>
              <button class="btn secondary" id="close-modal">Cerrar</button>
            </div>
          </section>
        </div>
      </div>`;
    modal.hidden=false;
    let rating=5;
    const paint=()=>$$('#rating-row span').forEach(s=>s.classList.toggle("active",Number(s.dataset.star)<=rating));
    $$('#rating-row span').forEach(s=>s.addEventListener("click",()=>{rating=Number(s.dataset.star);paint();}));
    paint();
    $("#send-compliment").onclick=async()=>{await insertCompliment({team_member_id:member.id,team_member_name:member.name,rating,message:$("#compliment-text").value});modal.hidden=true;};
    $("#close-modal").onclick=()=>modal.hidden=true;
    modal.onclick=(ev)=>{ if(ev.target===modal) modal.hidden=true; };
  }

  function emptyState(label="contenido"){return `<article class="card empty-card"><h3>Aún no se ha subido nada.</h3><p>Cuando se publique ${esc(label)}, aparecerá en este espacio.</p></article>`;}
  async function renderApps(){const rows=await list("app_modules");$("#app").innerHTML=moduleHero("apps","Ecosistema de herramientas","Lanzador de Apps","Accede a las herramientas digitales del sistema de calidad, logística, auditoría, capacitación y mejora continua.",canManageContent()?'<a class="btn" href="#/admin?tab=app_modules">Administrar Apps</a>':"");$("#module-content").innerHTML=`<div class="toolbar"><h3>Apps disponibles</h3><div class="filters"><input id="filter" placeholder="Buscar App..."></div></div><div class="grid cols-3" id="cards">${rows.length?rows.map(appCard).join(""):emptyState("Apps")}</div>`;bindFilter(rows,appCard);}
  function appCard(x){const link=x.url||x.external_url||"#";return `<article class="card"><img class="card-icon" src="${esc(x.image_url||x.icon_url||"assets/notifications/app.gif")}" alt=""><h3>${esc(x.name||x.title||"App")}</h3><p>${esc(x.description||"Sin descripción.")}</p><div class="card-footer"><span class="badge">${esc(x.status||"activa")}</span><a class="btn secondary" href="${esc(link)}" target="_blank" rel="noopener">Abrir App</a></div></article>`;}
  async function renderNews(){const rows=await list("news_posts");$("#app").innerHTML=moduleHero("news","Comunicación institucional","Noticias de calidad","Publicaciones oficiales sobre novedades, mejoras, capacitaciones y actualizaciones.",canManageContent()?'<a class="btn" href="#/admin?tab=news_posts">Crear noticia</a>':"");$("#module-content").innerHTML=`<div class="toolbar"><h3>Últimas noticias</h3></div><div class="grid cols-2">${rows.length?rows.map(x=>contentCard(x,"news_posts")).join(""):emptyState("noticias")}</div>`;}
  async function renderAudits(){const rows=await list("audit_reports");$("#app").innerHTML=moduleHero("audits","Auditoría y seguimiento","Auditorías","Consulta resultados, reportes y acciones de mejora.",canManageContent()?'<a class="btn" href="#/admin?tab=audit_reports">Gestionar auditorías</a>':"");$("#module-content").innerHTML=`<div class="toolbar"><h3>Reportes de auditoría</h3></div><div class="grid cols-2">${rows.length?rows.map(x=>contentCard(x,"audit_reports")).join(""):emptyState("auditorías")}</div>`;}
  async function renderDocuments(){const rows=await list("documents");$("#app").innerHTML=moduleHero("documents","Gestión documental","Documentos","Repositorio institucional para políticas, procedimientos, guías y formatos.",canManageContent()?'<a class="btn" href="#/admin?tab=documents">Gestionar documentos</a>':"");$("#module-content").innerHTML=`<div class="toolbar"><h3>Documentos publicados</h3></div><div class="grid cols-2">${rows.length?rows.map(x=>contentCard(x,"documents")).join(""):emptyState("documentos")}</div>`;}
  async function renderPublications(){const rows=await list("publications");$("#app").innerHTML=moduleHero("publications","Comunidad interna","Publicaciones","Muro institucional para reconocimientos y comunicaciones internas.",canManageContent()?'<a class="btn" href="#/admin?tab=publications">Crear publicación</a>':"");$("#module-content").innerHTML=`<div class="toolbar"><h3>Muro interno</h3></div><div class="grid cols-2">${rows.length?rows.map(x=>contentCard(x,"publications")).join(""):emptyState("publicaciones")}</div>`;}
  function contentCard(x,table){const cfg=TYPE_ASSETS[table]||TYPE_ASSETS.general;const title=x.title||x.name||"Registro";const desc=x.description||x.content||"";const link=x.file_url||x.external_url||x.url||"#";return `<article class="card"><img class="card-icon" src="${esc(x.image_url||cfg.gif)}" alt=""><h3>${esc(title)}</h3><p>${esc(desc)}</p><div class="card-footer"><span class="badge">${esc(x.status||x.publication_type||"publicado")}</span><a class="btn secondary" href="${esc(link)}" target="_blank" rel="noopener">Abrir enlace</a></div></article>`;}
  function bindFilter(rows,renderer){$("#filter")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#cards").innerHTML=rows.filter(x=>JSON.stringify(x).toLowerCase().includes(q)).map(renderer).join("")||emptyState("Apps");});}

  async function renderProfile(){ $("#app").innerHTML=`<section class="section"><div class="container"><div class="module-hero"><div class="module-hero-content"><span class="kicker">Mi perfil</span><h2>Perfil de usuario</h2><p>Información actual del usuario y rol dentro del portal.</p></div><article class="card"><h3>${esc(state.profile?.full_name||state.session?.user?.email||"Usuario visitante")}</h3><p><strong>Rol:</strong> ${esc(getRole())}</p><p><strong>Estado:</strong> ${state.session?"Sesión activa":"Sin sesión"}</p></article></div></div></section>`;}
  function currentAdminTab(){return params().get("tab")||"visual";}
  async function renderAdmin(){
    if(!canManageContent()){
      $("#app").innerHTML=`<section class="section"><div class="container"><div class="hero"><h2>Administración</h2><p>Ingresa con un usuario autorizado para administrar el portal.</p><button class="btn" id="open-login">Ingresar</button></div></div></section>`;
      $("#open-login")?.addEventListener("click",openLogin);
      return;
    }

    let tab=currentAdminTab();
    const superTabs=[["visual","Visual Studio"]];
    const contentTabs=[["banners","Banners"],["mascot","Mascota"],["team","Equipo"],["app_modules","Apps"],["news_posts","Noticias"],["audit_reports","Auditorías"],["documents","Documentos"],["publications","Publicaciones"]];
    const tabs=isSuperAdmin() ? [...superTabs, ...contentTabs] : contentTabs;

    if(!isSuperAdmin() && tab==="visual"){
      tab="banners";
      history.replaceState(null,"", "#/admin?tab=banners");
    }

    $("#app").innerHTML=`<section class="section"><div class="container"><div class="admin-layout"><aside class="admin-menu">${tabs.map(([k,l])=>`<button class="btn ${tab===k?"active":""}" data-admin-tab="${k}">${l}</button>`).join("")}</aside><section class="admin-panel" id="admin-panel"></section></div></div></section>`;
    $$(".admin-menu button").forEach(b=>b.addEventListener("click",()=>location.hash=`#/admin?tab=${b.dataset.adminTab}`));

    if(tab==="visual"){
      if(!isSuperAdmin()){
        renderCrud("banners");
      }else{
        renderVisualStudio();
      }
    }else{
      renderCrud(tab);
    }
  }
  function assetOptions(selected){return ASSETS.map(a=>`<option value="${esc(a.value)}" ${a.value===selected?"selected":""}>${esc(a.label)}</option>`).join("");}
  function renderVisualStudio(){
    $("#admin-panel").innerHTML=`<span class="kicker">Control visual</span><h2>Visual Studio Global</h2><p>Edita fondo, paneles, assets, tamaños, opacidad y movimiento.</p><div class="form-grid"><label><span>Escala paneles</span><div class="range-line"><input type="range" id="global-panel" min="70" max="115" value="${Math.round((state.visual.panelScale||1)*100)}"><output>${Math.round((state.visual.panelScale||1)*100)}%</output></div></label><label><span>Escala visual</span><div class="range-line"><input type="range" id="global-media" min="0" max="100" value="${Math.round((state.visual.mediaScale||1)*100)}"><output>${Math.round((state.visual.mediaScale||1)*100)}%</output></div></label><label><span>Escala texto</span><div class="range-line"><input type="range" id="global-font" min="88" max="112" value="${Math.round((state.visual.fontScale||1)*100)}"><output>${Math.round((state.visual.fontScale||1)*100)}%</output></div></label><label><span>Opacidad fondo</span><div class="range-line"><input type="range" id="bg-opacity" min="0" max="35" value="${Number(state.visual.backgroundOpacity||8)}"><output>${Number(state.visual.backgroundOpacity||8)}%</output></div></label><label><span>Movimiento reducido</span><select id="reduced-motion"><option value="false">No</option><option value="true" ${state.visual.reducedMotion?"selected":""}>Sí</option></select></label><label><span>Loop fondo</span><select id="bg-loop"><option value="true" ${state.visual.backgroundLoop!==false?"selected":""}>Sí</option><option value="false" ${state.visual.backgroundLoop===false?"selected":""}>No</option></select></label><label class="span-2"><span>Fondo GIF/video/imagen máximo 20 MB</span><input type="file" id="bg-upload" accept="image/*,video/mp4,video/webm"></label></div><hr><div class="grid cols-2">${Object.keys(state.modulePanels).map(panelEditor).join("")}</div><div class="actions"><button class="btn" id="save-visual">Guardar cambios visuales</button><button class="btn secondary" id="reset-visual">Restaurar base limpia</button></div>`;
    bindVisualInputs($("#admin-panel"));
  }
  function panelEditor(key){const p=state.modulePanels[key];return `<article class="card" data-panel-editor="${key}"><h3>${esc(key.toUpperCase())}</h3><label><span>Etiqueta</span><input data-field="badge" value="${esc(p.badge)}"></label><label><span>Título</span><input data-field="title" value="${esc(p.title)}"></label><label><span>Descripción</span><textarea data-field="description">${esc(p.description)}</textarea></label><label><span>Visual del panel</span><select data-field="mediaUrl">${assetOptions(p.mediaUrl)}</select></label><label><span>Subir visual</span><input type="file" data-upload-panel="${key}" accept="image/*,video/mp4,video/webm"></label><label><span>Tamaño panel</span><div class="range-line"><input type="range" data-field="panelScale" min="70" max="115" value="${Number(p.panelScale||100)}"><output>${Number(p.panelScale||100)}%</output></div></label><label><span>Tamaño imagen/video</span><div class="range-line"><input type="range" data-field="mediaScale" min="0" max="100" value="${Number(p.mediaScale||100)}"><output>${Number(p.mediaScale||100)}%</output></div></label><button class="btn secondary" data-clear-panel="${key}">Quitar visual</button></article>`;}
  function bindVisualInputs(scope){
    const live=()=>{state.visual.panelScale=Number($("#global-panel").value)/100;state.visual.mediaScale=Number($("#global-media").value)/100;state.visual.fontScale=Number($("#global-font").value)/100;state.visual.backgroundOpacity=Number($("#bg-opacity").value);state.visual.reducedMotion=$("#reduced-motion").value==="true";state.visual.backgroundLoop=$("#bg-loop").value==="true";applyVisual();scope.querySelectorAll("output").forEach(out=>{const inp=out.previousElementSibling;if(inp?.type==="range")out.textContent=`${inp.value}%`;});};
    ["global-panel","global-media","global-font","bg-opacity","reduced-motion","bg-loop"].forEach(id=>$("#"+id)?.addEventListener("input",live));
    $("#bg-upload")?.addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;const url=await uploadAsset(file,"background");if(url){state.visual.backgroundUrl=url;await saveHomeSettings();applyVisual();}});
    scope.querySelectorAll("[data-panel-editor]").forEach(card=>{const key=card.dataset.panelEditor;card.querySelectorAll("[data-field]").forEach(input=>input.addEventListener("input",()=>{let v=input.value;if(input.dataset.field==="panelScale"||input.dataset.field==="mediaScale")v=Number(v);state.modulePanels[key][input.dataset.field]=v;saveState();card.querySelectorAll("output").forEach(out=>{const inp=out.previousElementSibling;if(inp?.type==="range")out.textContent=`${inp.value}%`;});}));card.querySelector(`[data-clear-panel="${key}"]`)?.addEventListener("click",()=>{state.modulePanels[key].mediaUrl="";saveState();renderVisualStudio();});card.querySelector(`[data-upload-panel="${key}"]`)?.addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;const url=await uploadAsset(file,key);if(url){state.modulePanels[key].mediaUrl=url;saveState();await saveHomeSettings();renderVisualStudio();}});});
    $("#save-visual")?.addEventListener("click",async()=>{if(await saveHomeSettings()){toast("Visualización guardada","Los cambios quedaron guardados en Supabase.",{gif:"assets/notifications/success.gif",sound:"assets/notifications/new-notification.mp3"});render();}});
    $("#reset-visual")?.addEventListener("click",()=>{localStorage.removeItem(STORAGE_KEY);state=loadState();applyVisual();render();});
  }
  function renderCrud(tab){
    const isLocal = ["banners","mascot","team"].includes(tab);
    const rows = isLocal ? getLocalAdminRows(tab) : [];
    const labels = {
      banners:"Banners",
      mascot:"Mascota",
      team:"Equipo",
      app_modules:"Apps",
      news_posts:"Noticias",
      audit_reports:"Auditorías",
      documents:"Documentos",
      publications:"Publicaciones"
    };

    $("#admin-panel").innerHTML = `
      <span class="kicker">Administración</span>
      <h2>${labels[tab] || tab}</h2>
      <p class="admin-help">En cada tarjeta encontrarás los botones <strong>Editar</strong> y <strong>Eliminar</strong>. Al editar, también aparece el botón <strong>Eliminar este registro</strong> dentro del formulario.</p>
      ${crudForm(tab)}
      <div class="grid cols-2" style="margin-top:18px" id="admin-list">
        ${isLocal ? (rows.length ? rows.map(x => adminCard(x, tab)).join("") : emptyState("registros")) : ""}
      </div>
    `;

    bindCrud(tab);

    if(isLocal){
      bindAdminRecordButtons(tab, rows);
    }else{
      loadAdminRemote(tab);
    }
  }

  function getLocalAdminRows(tab){
    if(tab === "banners") return state.banners || [];
    if(tab === "mascot") return state.mascot || [];
    if(tab === "team") return state.team || [];
    return [];
  }

  async function loadAdminRemote(table){
    const rows = await list(table);
    $("#admin-list").innerHTML = rows.length
      ? rows.map(x => adminCard(x, table)).join("")
      : emptyState("registros");

    bindAdminRecordButtons(table, rows);
  }

  function adminCard(x, table){
    const title = x.name || x.title || "Registro";
    const description = x.description || x.content || x.bio || "";
    const asset = x.image_url || x.icon_url || x.media_url || x.photo_url || "";
    const link = x.url || x.external_url || x.file_url || x.link_url || "";

    return `
      <article class="card admin-record-card" data-admin-card="${esc(x.id)}">
        ${asset ? `<img class="card-icon" src="${esc(asset)}" alt="">` : ""}
        <h3>${esc(title)}</h3>
        <p>${esc(description || "Sin descripción.")}</p>
        ${link ? `<p class="admin-card-link"><small>${esc(link)}</small></p>` : ""}
        <div class="card-footer admin-card-actions">
          <button class="btn secondary" type="button" data-edit-record="${esc(x.id)}">Editar</button>
          <button class="btn danger" type="button" data-delete-record="${esc(x.id)}">Eliminar</button>
        </div>
      </article>
    `;
  }

  function bindAdminRecordButtons(table, rows){
    $$('[data-edit-record]').forEach(btn => {
      btn.addEventListener('click', () => {
        const record = rows.find(x => String(x.id) === String(btn.dataset.editRecord));
        if(record) fillCrudForm(table, record);
      });
    });

    $$('[data-delete-record]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const record = rows.find(x => String(x.id) === String(btn.dataset.deleteRecord));
        const title = record?.name || record?.title || 'este registro';
        const ok = confirm(`¿Seguro que deseas eliminar "${title}"? Esta acción no se puede deshacer.`);
        if(!ok) return;

        const deleted = await deleteRecord(table, btn.dataset.deleteRecord);
        if(deleted) renderAdmin();
      });
    });
  }

  function fillCrudForm(table, record){
    const form = $('#crud-form');
    if(!form || !record) return;

    form.elements.id.value = record.id || '';
    form.elements.title.value = record.name || record.title || '';
    form.elements.status.value = record.role || record.status || '';
    form.elements.description.value = record.description || record.content || record.bio || '';
    form.elements.url.value = record.url || record.external_url || record.file_url || record.link_url || '';

    if(form.elements.button_text){
      form.elements.button_text.value = record.button_text || '';
    }
    if(form.elements.subtitle){
      form.elements.subtitle.value = record.subtitle || '';
    }
    if(form.elements.animation){
      form.elements.animation.value = record.animation || 'fade';
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if(submitBtn) submitBtn.textContent = 'Actualizar';

    const deleteBtn = $('#delete-current-record');
    if(deleteBtn){
      deleteBtn.hidden = false;
      deleteBtn.dataset.table = table;
      deleteBtn.dataset.id = record.id || '';
      deleteBtn.dataset.title = record.name || record.title || 'este registro';
    }

    form.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function crudForm(tab){
    const banner = tab === 'banners';
    const team = tab === 'team';

    return `
      <form id="crud-form" class="form-grid">
        <input type="hidden" name="id">
        <label>
          <span>${team ? 'Nombre' : 'Título / Nombre'}</span>
          <input name="title" required>
        </label>
        <label>
          <span>${team ? 'Cargo' : 'Estado'}</span>
          <input name="status" value="${team ? 'Calidad y mejora continua' : 'publicado'}">
        </label>
        ${banner ? `
          <label>
            <span>Subtítulo</span>
            <input name="subtitle">
          </label>
          <label>
            <span>Animación</span>
            <select name="animation">
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="zoom">Zoom</option>
            </select>
          </label>
        ` : ''}
        <label class="span-2">
          <span>Descripción / contenido</span>
          <textarea name="description" rows="4"></textarea>
        </label>
        <label>
          <span>Link directo / OneDrive / App</span>
          <input name="url" placeholder="https://...">
        </label>
        <label>
          <span>Botón</span>
          <input name="button_text" placeholder="Abrir">
        </label>
        <label>
          <span>Asset del portal</span>
          <select name="asset">
            <option value="">Mantener visual actual o subir nuevo</option>
            ${assetOptions('')}
          </select>
        </label>
        <label>
          <span>Subir archivo visual</span>
          <input type="file" name="file" accept="image/*,video/mp4,video/webm">
        </label>
        <div class="actions span-2">
          <button class="btn" type="submit">Guardar</button>
          <button class="btn danger" type="button" id="delete-current-record" hidden>Eliminar este registro</button>
        </div>
      </form>
    `;
  }

  function bindCrud(tab){
    const deleteCurrent = $('#delete-current-record');
    if(deleteCurrent){
      deleteCurrent.addEventListener('click', async () => {
        const id = deleteCurrent.dataset.id;
        const table = deleteCurrent.dataset.table || tab;
        const title = deleteCurrent.dataset.title || 'este registro';
        if(!id) return;
        const ok = confirm(`¿Seguro que deseas eliminar "${title}"? Esta acción no se puede deshacer.`);
        if(!ok) return;
        const deleted = await deleteRecord(table, id);
        if(deleted) renderAdmin();
      });
    }

    $('#crud-form').addEventListener('submit', async e => {
      e.preventDefault();

      const fd = new FormData(e.currentTarget);
      const file = fd.get('file');
      let media = fd.get('asset') || '';
      const id = fd.get('id') || crypto.randomUUID();
      const title = fd.get('title');

      if(file && file.size){
        media = await uploadAsset(file, tab);
        if(!media){
          toast("No se guardó el registro", "Primero debe subir correctamente el archivo a Supabase.", {
            gif:"assets/notifications/loading.gif",
            sound:"assets/notifications/new-notification.mp3"
          });
          return;
        }
      }

      if(tab === 'banners'){
        const previous = (state.banners || []).find(x => String(x.id) === String(id)) || {};
        const payload = {
          ...previous,
          id,
          title,
          subtitle:fd.get('subtitle'),
          description:fd.get('description'),
          button_text:fd.get('button_text') || previous.button_text || 'Abrir',
          link_url:fd.get('url') || previous.link_url || '#/apps',
          media_url:media || previous.media_url || 'assets/home/banner-placeholder.svg',
          animation:fd.get('animation') || previous.animation || 'fade',
          is_active:true,
          sort_order:previous.sort_order || 0
        };
        state.banners = [payload, ...(state.banners || []).filter(x => String(x.id) !== String(id))].slice(0,15);
        if(!(await saveHomeSettings())) return;
        notifyType(tab, title);
        renderAdmin();
        return;
      }

      if(tab === 'mascot'){
        const previous = (state.mascot || []).find(x => String(x.id) === String(id)) || {};
        const payload = {
          ...previous,
          id,
          name:title,
          title,
          description:fd.get('description'),
          media_url:media || previous.media_url || 'assets/mascot/mascot-placeholder.svg',
          is_active:true,
          sort_order:previous.sort_order || 0
        };
        state.mascot = [payload, ...(state.mascot || []).filter(x => String(x.id) !== String(id))].slice(0,15);
        if(!(await saveHomeSettings())) return;
        notifyType(tab, title);
        renderAdmin();
        return;
      }

      if(tab === 'team'){
        const previous = (state.team || []).find(x => String(x.id) === String(id)) || {};
        const payload = {
          ...previous,
          id,
          name:title,
          role:fd.get('status'),
          bio:fd.get('description'),
          photo_url:media || previous.photo_url || 'assets/team/team-placeholder.svg',
          is_active:true,
          sort_order:previous.sort_order || 0
        };
        state.team = [payload, ...(state.team || []).filter(x => String(x.id) !== String(id))];
        if(!(await saveHomeSettings())) return;
        notifyType(tab, title);
        renderAdmin();
        return;
      }

      let payload = {
        id,
        title,
        name:title,
        description:fd.get('description'),
        status:fd.get('status') || 'publicado',
        visibility:'interna',
        is_active:true,
        is_featured:true,
        updated_at:new Date().toISOString()
      };

      if(tab === 'app_modules'){
        payload = { ...payload, url:fd.get('url') || '#', external_url:fd.get('url') || '#' };
        if(media) payload.image_url = media;
      }else if(tab === 'documents'){
        payload = { ...payload, file_url:fd.get('url') || '#', external_url:fd.get('url') || '#' };
        if(media) payload.image_url = media;
      }else if(tab === 'publications'){
        payload = { ...payload, content:fd.get('description'), file_url:fd.get('url') || '#', external_url:fd.get('url') || '#', publication_type:'novedad' };
        if(media) payload.image_url = media;
      }else{
        payload = { ...payload, file_url:fd.get('url') || '#', external_url:fd.get('url') || '#' };
        if(media) payload.image_url = media;
      }

      await upsert(tab, payload);
      notifyType(tab, title);
      renderAdmin();
    });
  }

  function notifyType(table,title){const cfg=TYPE_ASSETS[table]||TYPE_ASSETS.general;toast(cfg.label,title?`Te invitamos a revisarlo: ${title}`:"Hay una novedad en el portal.",{gif:cfg.gif,sound:cfg.sound,duration:6500});}
  function renderViewPanel(){
    const adminLink = isSuperAdmin()
      ? '<a class="btn secondary" href="#/admin?tab=visual">Abrir Visual Studio</a>'
      : (canManageContent() ? '<a class="btn secondary" href="#/admin?tab=banners">Abrir administración</a>' : '');
    $("#view-panel").innerHTML=`<h3>Acomodar vista</h3><div class="view-grid"><label><span>Escala texto</span><input id="quick-font" type="range" min="88" max="112" value="${Math.round((state.visual.fontScale||1)*100)}"></label><label><span>Escala paneles</span><input id="quick-panel" type="range" min="70" max="115" value="${Math.round((state.visual.panelScale||1)*100)}"></label><label><span>Escala visuales</span><input id="quick-media" type="range" min="0" max="100" value="${Math.round((state.visual.mediaScale||1)*100)}"></label><label><span>Movimiento reducido</span><select id="quick-motion"><option value="false">No</option><option value="true" ${state.visual.reducedMotion?"selected":""}>Sí</option></select></label>${adminLink}</div>`;
    const sync=()=>{state.visual.fontScale=Number($("#quick-font").value)/100;state.visual.panelScale=Number($("#quick-panel").value)/100;state.visual.mediaScale=Number($("#quick-media").value)/100;state.visual.reducedMotion=$("#quick-motion").value==="true";applyVisual();};
    ["quick-font","quick-panel","quick-media","quick-motion"].forEach(id=>$("#"+id)?.addEventListener("input",sync));
  }
  function openLogin(){const modal=$("#modal");modal.innerHTML=`<div class="modal-card"><h2>Ingresar</h2><p>Ingresa con Supabase o activa Super Admin local para configurar el portal.</p><div class="form-grid"><label class="span-2"><span>Correo</span><input id="login-email" value="${esc(window.DREAM_CONFIG?.superAdminEmail||"")}"></label><label class="span-2"><span>Clave Supabase</span><input id="login-pass" type="password"></label></div><div class="actions"><button class="btn" id="login-supabase">Ingresar con Supabase</button><button class="btn secondary" id="login-local">Activar Super Admin local</button><button class="btn secondary" id="close-modal">Cerrar</button></div></div>`;modal.hidden=false;$("#close-modal").onclick=()=>modal.hidden=true;$("#login-local").onclick=()=>{const e=$("#login-email").value;state.profile={email:e,role:e.toLowerCase()===(window.DREAM_CONFIG?.superAdminEmail||"").toLowerCase()?"super_admin":"admin",full_name:e,is_active:true};saveState();modal.hidden=true;renderAuth();render();};$("#login-supabase").onclick=async()=>{if(!supabaseClient)return toast("Supabase no configurado","Revisa js/config.js.");const {error}=await supabaseClient.auth.signInWithPassword({email:$("#login-email").value,password:$("#login-pass").value});if(error)toast("Error de ingreso",error.message);else{modal.hidden=true;render();}};}
  function renderAuth(){const btn=$("#auth-btn");if(!btn)return;btn.textContent=state.profile||state.session?"Salir":"Ingresar";btn.onclick=async()=>{if(state.profile||state.session){if(supabaseClient)await supabaseClient.auth.signOut();state.profile=null;state.session=null;saveState();renderAuth();render();}else openLogin();};}
  async function render(){setRoute(routeName());$("#main-nav")?.classList.remove("open");clearInterval(bannerTimer);clearInterval(mascotTimer);switch(state.route){case"apps":await renderApps();break;case"noticias":await renderNews();break;case"auditorias":await renderAudits();break;case"documentos":await renderDocuments();break;case"publicaciones":await renderPublications();break;case"perfil":await renderProfile();break;case"admin":await renderAdmin();break;default:await renderHome();}bindPanelButtons();playVisibleVideos();}
  function bindPanelButtons(){$$("[data-edit-panel]").forEach(btn=>btn.addEventListener("click",()=>{if(!isSuperAdmin())return openLogin();location.hash="#/admin?tab=visual";}));}
  function playVisibleVideos(){$$("video").forEach(v=>{v.muted=true;v.playsInline=true;v.setAttribute("playsinline","");v.setAttribute("autoplay","");v.setAttribute("loop","");v.play?.().catch(()=>{});});}

  function openCreatorCertificate(){
    const modal = $("#modal");
    const isSecure = location.protocol === "https:";
    const issuedAt = new Date().toLocaleDateString("es-CO", {
      year:"numeric",
      month:"long",
      day:"2-digit"
    });
    const siteUrl = location.href.split("#")[0];
    modal.innerHTML = `
      <div class="modal-card creator-certificate-modal">
        <div class="certificate-sheet">
          <aside class="certificate-gif">
            <img src="assets/notifications/success.gif" alt="Certificación del portal" loading="eager">
            <span class="ssl-pill ${isSecure ? "ok" : "warn"}">${isSecure ? "SSL/TLS activo" : "SSL no detectado"}</span>
          </aside>
          <section class="certificate-content">
            <span class="kicker">Certificado de creación</span>
            <h2>Portal Dream Team de Calidad y Mejoramiento Continuo</h2>
            <p class="certificate-lead">
              Se deja constancia de que este portal fue creado, estructurado y configurado para la gestión institucional de Apps, noticias, documentos, auditorías, publicaciones y recursos internos del equipo de Calidad y Mejora Continua.
            </p>

            <div class="certificate-grid">
              <div>
                <small>Creador</small>
                <strong>Juan Esteban Pérez</strong>
              </div>
              <div>
                <small>Cargo</small>
                <strong>Analista de Calidad</strong>
              </div>
              <div>
                <small>Tipo de certificación</small>
                <strong>Certificado interno de creación digital</strong>
              </div>
              <div>
                <small>Fecha de expedición</small>
                <strong>${esc(issuedAt)}</strong>
              </div>
              <div>
                <small>Sitio certificado</small>
                <strong>${esc(siteUrl)}</strong>
              </div>
              <div>
                <small>Seguridad de conexión</small>
                <strong>${isSecure ? "HTTPS con SSL/TLS activo" : "Abrir por HTTPS para activar SSL/TLS"}</strong>
              </div>
            </div>

            <div class="certificate-note">
              <strong>Nota SSL:</strong>
              En GitHub Pages el certificado SSL/TLS real lo emite y administra GitHub cuando el sitio se abre por HTTPS. Esta constancia visual verifica si la página está cargando bajo conexión segura.
            </div>

            <div class="certificate-sign">
              <div>
                <strong>Juan Esteban Pérez</strong>
                <span>Analista de Calidad · Creador del portal</span>
              </div>
              <div class="certificate-seal">DT</div>
            </div>

            <div class="actions no-print">
              <button class="btn" id="print-certificate" type="button">Imprimir / guardar PDF</button>
              <button class="btn secondary" id="close-modal" type="button">Cerrar</button>
            </div>
          </section>
        </div>
      </div>`;
    modal.hidden=false;
    $("#print-certificate")?.addEventListener("click",()=>window.print());
    $("#close-modal")?.addEventListener("click",()=>modal.hidden=true);
    modal.onclick=(ev)=>{ if(ev.target===modal) modal.hidden=true; };
  }

  function bindShell(){$("#menu-btn").addEventListener("click",()=>$("#main-nav").classList.toggle("open"));$("#view-toggle").addEventListener("click",()=>{const p=$("#view-panel");p.hidden=!p.hidden;if(!p.hidden)renderViewPanel();});$("#audio-btn").addEventListener("click",()=>toast("Accesibilidad sonora","Las notificaciones visuales y sonoras están activas.",{gif:"assets/notifications/loading.gif",sound:"assets/notifications/new-notification.mp3"}));$("#creator-cert-btn")?.addEventListener("click",openCreatorCertificate);window.addEventListener("hashchange",render);document.addEventListener("visibilitychange",()=>{if(!document.hidden)playVisibleVideos();});}
  async function boot(){applyVisual();bindShell();await initSupabase();renderAuth();await render();}
  document.addEventListener("DOMContentLoaded",boot);
})();
