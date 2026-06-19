/* ============================================================================
 * SCG · CRM — Capa de datos (Supabase + modo mock)
 * Expone window.CRM_DB. Mismo proyecto Supabase que el portal.
 * Login: usuario (->@portal.santacruzconsulting.co) o email + contraseña.
 * Acceso: solo staff (crm_members). Mock: ?mock=1&as=admin  ó  ?mock=1&as=manager
 * ==========================================================================*/
(function (global) {
  "use strict";
  var SUPABASE_URL = "https://wtuytdjsvfakbojpbqer.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_pf9eCYfTH6jUO5oeOQjrmQ_DgvfNDmr";
  var LOGIN_DOMAIN = "portal.santacruzconsulting.co";

  var qp = new URLSearchParams(global.location ? global.location.search : "");
  var configurado = SUPABASE_URL.indexOf("http") === 0 && SUPABASE_ANON_KEY.length > 20;
  var MOCK = qp.get("mock") === "1" || !configurado;
  function userToEmail(u){ u=String(u||"").trim().toLowerCase(); return u.indexOf("@")>=0?u:u+"@"+LOGIN_DOMAIN; }

  // =========================================================================
  // BACKEND REAL
  // =========================================================================
  function realDB(){
    var c = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    var ok = function(r){ if(r.error) throw r.error; return r.data; };
    return {
      mock:false,
      signIn:function(usuario,password){ return c.auth.signInWithPassword({email:userToEmail(usuario),password:password}).then(function(r){ if(r.error) throw r.error; return r.data; }); },
      getEmail:function(){ return c.auth.getSession().then(function(r){ return r.data.session?r.data.session.user.email:null; }); },
      signOut:function(){ return c.auth.signOut(); },
      isMember:function(){ return c.rpc("is_crm_member").then(function(r){ return !!r.data; }); },
      isAdmin:function(){ return c.rpc("is_crm_admin").then(function(r){ return !!r.data; }); },
      // catálogos
      cfgList:function(t){ return c.from(t).select("*").order("id").then(ok); },
      cfgSave:function(t,row){ var q=row.id?c.from(t).update(row).eq("id",row.id):c.from(t).insert(row); return q.then(ok); },
      cfgDelete:function(t,id){ return c.from(t).delete().eq("id",id).then(ok); },
      // members
      listMembers:function(){ return c.from("crm_members").select("*").order("email").then(ok); },
      saveMember:function(m){ return c.from("crm_members").upsert(m,{onConflict:"email"}).then(ok); },
      deleteMember:function(email){ return c.from("crm_members").delete().eq("email",email).then(ok); },
      // contactos
      listContacts:function(){ return c.from("crm_contacts").select("*").order("updated_at",{ascending:false}).then(ok); },
      saveContact:function(o){ var q=o.id?c.from("crm_contacts").update(o).eq("id",o.id):c.from("crm_contacts").insert(o); return q.select().then(ok); },
      deleteContact:function(id){ return c.from("crm_contacts").delete().eq("id",id).then(ok); },
      moveStage:function(id,stageId){ return c.from("crm_contacts").update({stage_id:stageId}).eq("id",id).then(ok); },
      // tags por contacto
      listContactTags:function(){ return c.from("crm_contact_tags").select("*").then(ok); },
      setContactTags:function(contactId,tagIds){
        return c.from("crm_contact_tags").delete().eq("contact_id",contactId).then(function(){
          if(!tagIds.length) return [];
          return c.from("crm_contact_tags").insert(tagIds.map(function(t){return{contact_id:contactId,tag_id:t};})).then(ok);
        });
      },
      // actividades
      listActivities:function(contactId){ return c.from("crm_activities").select("*").eq("contact_id",contactId).order("fecha",{ascending:false}).then(ok); },
      addActivity:function(a){ return c.from("crm_activities").insert(a).then(ok); },
      deleteActivity:function(id){ return c.from("crm_activities").delete().eq("id",id).then(ok); },
      // tareas
      listTasks:function(){ return c.from("crm_tasks").select("*").order("due_date",{nullsFirst:false}).then(ok); },
      saveTask:function(t){ var q=t.id?c.from("crm_tasks").update(t).eq("id",t.id):c.from("crm_tasks").insert(t); return q.then(ok); },
      deleteTask:function(id){ return c.from("crm_tasks").delete().eq("id",id).then(ok); },
      // compartir contacto puntual
      listShares:function(cid){ return c.from("crm_contact_shares").select("*").eq("contact_id",cid).then(ok); },
      addShare:function(cid,email){ return c.from("crm_contact_shares").insert({contact_id:cid,email:String(email).trim().toLowerCase()}).then(ok); },
      removeShare:function(cid,email){ return c.from("crm_contact_shares").delete().eq("contact_id",cid).eq("email",email).then(ok); },
      // compartir cartera completa de un dueño
      listBookAccess:function(){ return c.from("crm_book_access").select("*").then(ok); },
      addBookAccess:function(owner,email){ return c.from("crm_book_access").insert({owner_email:String(owner).trim().toLowerCase(),email:String(email).trim().toLowerCase()}).then(ok); },
      removeBookAccess:function(owner,email){ return c.from("crm_book_access").delete().eq("owner_email",owner).eq("email",email).then(ok); },
    };
  }

  // =========================================================================
  // BACKEND MOCK (localStorage)
  // =========================================================================
  function mockDB(){
    var LS="scg_crm_mock_v1"; var P=function(v){return Promise.resolve(v);};
    function uid(){ return "id-"+Math.abs((s.contacts.length+1)*2654435761 ^ s.contacts.length).toString(16)+"-"+s.contacts.length; }
    function seed(){
      var verticals=[{id:1,nombre:"Inversiones",activo:true,orden:1},{id:2,nombre:"Transferencias internacionales",activo:true,orden:2}];
      var stages=[{id:1,nombre:"Prospecto",orden:1},{id:2,nombre:"Contactado",orden:2},{id:3,nombre:"Reunión",orden:3},{id:4,nombre:"Propuesta",orden:4},{id:5,nombre:"Ganado",orden:5,es_ganado:true},{id:6,nombre:"Perdido",orden:6,es_perdido:true}];
      var categorias=[{id:1,nombre:"Alto patrimonio"},{id:2,nombre:"Pyme"},{id:3,nombre:"Particular"},{id:4,nombre:"Referido"},{id:5,nombre:"Corporativo"}];
      var comis=[{id:1,nombre:"Juan Fernando Subirana"},{id:2,nombre:"Nicolas Encina"},{id:3,nombre:"Daniela Amelunge"},{id:4,nombre:"Directo"}];
      var tags=[{id:1,nombre:"VIP",color:"#c9a96a"},{id:2,nombre:"Urgente",color:"#FF6463"},{id:3,nombre:"Seguimiento",color:"#B7D7C2"}];
      var contacts=[], ctags=[];
      var src=(global.SCG_DATA&&global.SCG_DATA.clientes)||[];
      src.filter(function(x){return x.estado!=="liquidado";}).forEach(function(x,i){
        contacts.push({id:"inv-"+i,nombre:x.nombre,email:x.id+"@pendiente.scg",telefono:null,empresa:null,
          vertical_id:1,categoria_id:1,comisionista_id:4,stage_id:5,estado:"ganado",valor_estimado:x.capital,
          owner_email:"admin@portal.santacruzconsulting.co",portal_client_id:x.id,nota:"Importado del portal",updated_at:"2026-05-31"});
      });
      // un par de prospectos de transferencias para demo
      contacts.push({id:"tr-1",nombre:"Importadora del Oriente SRL",email:"compras@idoriente.bo",telefono:"+591 7000000",empresa:"Importadora del Oriente",vertical_id:2,categoria_id:5,comisionista_id:1,stage_id:2,estado:"abierto",valor_estimado:50000,owner_email:"admin@portal.santacruzconsulting.co",nota:"Necesita girar a proveedores en China",updated_at:"2026-06-01"});
      contacts.push({id:"tr-2",nombre:"Marcelo Áñez",email:"manez@gmail.com",telefono:"+591 7011111",empresa:null,vertical_id:2,categoria_id:3,comisionista_id:4,stage_id:1,estado:"abierto",valor_estimado:8000,owner_email:"admin@portal.santacruzconsulting.co",nota:"Consulta por transferencia a EEUU",updated_at:"2026-06-02"});
      ctags.push({contact_id:"tr-1",tag_id:1},{contact_id:"tr-2",tag_id:3});
      var activities=[{id:"a1",contact_id:"tr-1",tipo:"llamada",descripcion:"Primera llamada, interesado en girar USD 50k/mes a China.",fecha:"2026-06-01",author_email:"admin@portal.santacruzconsulting.co"}];
      var tasks=[{id:"t1",contact_id:"tr-1",titulo:"Enviar cotización de comisión",due_date:"2026-06-05",done:false,assigned_to_email:"admin@portal.santacruzconsulting.co"},
                 {id:"t2",contact_id:"tr-2",titulo:"Llamar para agendar reunión",due_date:"2026-06-03",done:false,assigned_to_email:"admin@portal.santacruzconsulting.co"}];
      var members=[{email:"admin@portal.santacruzconsulting.co",nombre:"Admin",role:"admin",active:true},{email:"ronaldamelunge@portal.santacruzconsulting.co",nombre:"Ronald Amelunge",role:"admin",active:true},{email:"manager@portal.santacruzconsulting.co",nombre:"Manager Demo",role:"manager",active:true}];
      return {verticals:verticals,stages:stages,categorias:categorias,comisionistas:comis,tags:tags,contacts:contacts,contact_tags:ctags,activities:activities,tasks:tasks,members:members,book_access:[],contact_shares:[]};
    }
    function load(){ try{var j=JSON.parse(localStorage.getItem(LS)); if(j&&j.contacts) return j;}catch(e){} return seed(); }
    function save(){ try{localStorage.setItem(LS,JSON.stringify(s));}catch(e){} }
    var s=load();
    var asRole=qp.get("as")||"admin";
    var sessionEmail = asRole==="manager"?"manager@portal.santacruzconsulting.co":"admin@portal.santacruzconsulting.co";
    function meAdmin(){ return s.members.some(function(m){return m.email.toLowerCase()===(sessionEmail||'').toLowerCase()&&m.active&&m.role==='admin';}); }
    function canSee(c){ if(meAdmin())return true; var me=(sessionEmail||'').toLowerCase();
      if((c.owner_email||'').toLowerCase()===me) return true;
      if(s.contact_shares.some(function(x){return x.contact_id===c.id&&x.email.toLowerCase()===me;})) return true;
      if(s.book_access.some(function(b){return (b.owner_email||'').toLowerCase()===(c.owner_email||'').toLowerCase()&&b.email.toLowerCase()===me;})) return true;
      return false; }
    var T={crm_verticals:"verticals",crm_categorias:"categorias",crm_comisionistas:"comisionistas",crm_stages:"stages",crm_tags:"tags"};
    function genId(arr){ return arr.reduce(function(m,x){return Math.max(m,x.id||0);},0)+1; }
    function cuid(){ return "id-"+Date2(); } function Date2(){ return (s.contacts.length+s.activities.length+s.tasks.length+1)+"-"+Math.floor(performance.now?performance.now():0); }
    return {
      mock:true,
      signIn:function(usuario){ sessionEmail=userToEmail(usuario); save(); return P({}); },
      getEmail:function(){ return P(sessionEmail); },
      signOut:function(){ sessionEmail=null; return P(true); },
      isMember:function(){ return P(!!sessionEmail && s.members.some(function(m){return m.email.toLowerCase()===sessionEmail.toLowerCase()&&m.active;})); },
      isAdmin:function(){ return P(!!sessionEmail && s.members.some(function(m){return m.email.toLowerCase()===sessionEmail.toLowerCase()&&m.active&&m.role==="admin";})); },
      cfgList:function(t){ return P((s[T[t]]||[]).slice()); },
      cfgSave:function(t,row){ var arr=s[T[t]]; if(row.id){var i=arr.findIndex(function(x){return x.id===row.id;}); arr[i]=Object.assign({},arr[i],row);} else {row.id=genId(arr); arr.push(row);} save(); return P(row); },
      cfgDelete:function(t,id){ s[T[t]]=s[T[t]].filter(function(x){return x.id!==id;}); save(); return P(true); },
      listMembers:function(){ return P(s.members.slice()); },
      saveMember:function(m){ var i=s.members.findIndex(function(x){return x.email.toLowerCase()===m.email.toLowerCase();}); if(i>=0)s.members[i]=Object.assign({},s.members[i],m); else s.members.push(Object.assign({active:true},m)); save(); return P(m); },
      deleteMember:function(email){ if(s.members.filter(function(m){return m.role==="admin"&&m.active;}).length<=1){var t=s.members.find(function(m){return m.email===email;}); if(t&&t.role==="admin") return Promise.reject(new Error("No se puede eliminar el último admin."));} s.members=s.members.filter(function(m){return m.email!==email;}); save(); return P(true); },
      listContacts:function(){ return P(s.contacts.filter(canSee).sort(function(a,b){return (b.updated_at||"").localeCompare(a.updated_at||"");})); },
      saveContact:function(o){ if(o.id){var i=s.contacts.findIndex(function(x){return x.id===o.id;}); s.contacts[i]=Object.assign({},s.contacts[i],o,{updated_at:"2026-06-02"});} else {o.id=cuid(); o.updated_at="2026-06-02"; s.contacts.push(o);} save(); return P([o]); },
      deleteContact:function(id){ s.contacts=s.contacts.filter(function(x){return x.id!==id;}); s.contact_tags=s.contact_tags.filter(function(x){return x.contact_id!==id;}); save(); return P(true); },
      moveStage:function(id,stageId){ var c=s.contacts.find(function(x){return x.id===id;}); if(c){c.stage_id=stageId; c.updated_at="2026-06-02";} save(); return P(true); },
      listContactTags:function(){ return P(s.contact_tags.slice()); },
      setContactTags:function(cid,ids){ s.contact_tags=s.contact_tags.filter(function(x){return x.contact_id!==cid;}); ids.forEach(function(t){s.contact_tags.push({contact_id:cid,tag_id:t});}); save(); return P(true); },
      listActivities:function(cid){ return P(s.activities.filter(function(a){return a.contact_id===cid;}).sort(function(a,b){return (b.fecha||"").localeCompare(a.fecha||"");})); },
      addActivity:function(a){ a.id=cuid(); s.activities.push(a); save(); return P(a); },
      deleteActivity:function(id){ s.activities=s.activities.filter(function(x){return x.id!==id;}); save(); return P(true); },
      listTasks:function(){ return P(s.tasks.slice().sort(function(a,b){return (a.due_date||"9999").localeCompare(b.due_date||"9999");})); },
      saveTask:function(t){ if(t.id){var i=s.tasks.findIndex(function(x){return x.id===t.id;}); s.tasks[i]=Object.assign({},s.tasks[i],t);} else {t.id=cuid(); s.tasks.push(t);} save(); return P(t); },
      deleteTask:function(id){ s.tasks=s.tasks.filter(function(x){return x.id!==id;}); save(); return P(true); },
      listShares:function(cid){ return P(s.contact_shares.filter(function(x){return x.contact_id===cid;})); },
      addShare:function(cid,email){ var e=String(email).trim().toLowerCase(); if(!s.contact_shares.some(function(x){return x.contact_id===cid&&x.email===e;})) s.contact_shares.push({contact_id:cid,email:e}); save(); return P(true); },
      removeShare:function(cid,email){ s.contact_shares=s.contact_shares.filter(function(x){return !(x.contact_id===cid&&x.email===email);}); save(); return P(true); },
      listBookAccess:function(){ return P(s.book_access.slice()); },
      addBookAccess:function(owner,email){ var o=String(owner).trim().toLowerCase(),e=String(email).trim().toLowerCase(); if(!s.book_access.some(function(x){return x.owner_email===o&&x.email===e;})) s.book_access.push({owner_email:o,email:e}); save(); return P(true); },
      removeBookAccess:function(owner,email){ s.book_access=s.book_access.filter(function(x){return !(x.owner_email===owner&&x.email===email);}); save(); return P(true); },
      _reset:function(){ localStorage.removeItem(LS); s=load(); },
    };
  }

  global.CRM_DB = MOCK ? mockDB() : realDB();
  global.CRM_DB.MOCK = MOCK;
})(typeof window !== "undefined" ? window : this);
