
/* ===============================================================
   MESA DE AYUDA DE CALIDAD - IA NIVEL 1 SIN API PAGA
   Motor conversacional con búsqueda interna, memoria y aprendizaje.
   Requiere Supabase JS v2 y tablas del archivo supabase_ia_nivel1_setup.sql.
   =============================================================== */
(function () {
  'use strict';

  const DEFAULT_OPTIONS = {
    minConfidence: 0.34,
    strongConfidence: 0.62,
    maxKnowledgeResults: 6,
    maxContextMessages: 12,
    appName: 'Mesa de Ayuda de Calidad',
    superAdminName: 'Juan Esteban Pérez',
    allowTicketDataLookup: true,
    debug: false
  };

  const BUILTIN_SYNONYMS = {
    saludar: ['hola','buenas','buenos dias','buenos días','qué más','que mas'],
    ayuda: ['ayuda','que puedes hacer','qué puedes hacer','opciones','menu','menú'],
    registrar_aprendizaje: ['aprende que','recuerda que','guarda que','ten en cuenta que','desde ahora','la regla es'],
    crear_ticket: ['radicar','crear solicitud','abrir caso','registrar caso','nuevo ticket','nueva solicitud'],
    consultar_ticket: ['buscar ticket','ver ticket','consultar radicado','revisar caso','dt-'],
    consultar_estado: ['estado','en que va','en qué va','avance','progreso','situación','situacion'],
    consultar_tickets_abiertos: ['abiertos','activos','pendientes','sin cerrar','en proceso'],
    consultar_tickets_vencidos: ['vencidos','atrasados','demorados','quietos','fuera de tiempo','se pasó','se paso'],
    consultar_mis_tickets: ['mis tickets','mis casos','asignados a mi','asignados a mí','mi bandeja'],
    consultar_responsable: ['responsable','asignado','quien lo tiene','quién lo tiene','encargado'],
    cerrar_ticket: ['cerrar','finalizar','terminar caso','dar por terminado','respuesta final'],
    agregar_evidencia: ['evidencia','soporte','adjunto','archivo','foto','captura','anexo'],
    ampliar_espera: ['ampliar espera','prorroga','prórroga','mas tiempo','más tiempo','aplazar'],
    escalar_ticket: ['escalar','subir al jefe','jefe general','super admin','elevar caso'],
    consultar_kpi: ['kpi','indicador','indicadores','dashboard','grafica','gráfica','productividad'],
    sugerir_mejora: ['mejora','accion de mejora','acción de mejora','causa raiz','causa raíz','control'],
    auditar_ticket: ['auditar','trazabilidad','historial','quien hizo','quién hizo','bitacora','bitácora'],
    error_sistema: ['error','falla','no carga','no guarda','no aparece','no me deja'],
    seguridad_datos: ['contraseña','pin','clave','token','llave','secreto','credencial']
  };

  const STOPWORDS = new Set(['el','la','los','las','un','una','unos','unas','de','del','que','y','o','a','en','por','para','con','sin','mi','mis','tu','tus','su','sus','es','son','se','me','lo','le','al','como','cómo','cual','cuál','cuando','cuándo','donde','dónde','este','esta','estos','estas','ese','esa','eso','hay','tengo','tiene','quiero','necesito']);

  function normalizeText(input) {
    return String(input || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9ñ\-\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(input) {
    return normalizeText(input).split(' ').filter(t => t.length > 2 && !STOPWORDS.has(t));
  }

  function unique(arr) { return Array.from(new Set(arr.filter(Boolean))); }

  function containsAny(haystack, needles) {
    const h = normalizeText(haystack);
    return needles.some(n => h.includes(normalizeText(n)));
  }

  function extractTicketCode(text) {
    const m = String(text || '').match(/\b(?:DT|TICKET|RAD)[-\s]?\d{1,8}\b/i) || String(text || '').match(/\b\d{3,8}\b/);
    return m ? m[0].replace(/\s+/g,'-').toUpperCase() : null;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  class MesaAyudaAI {
    constructor({ supabaseClient, currentUser = {}, options = {} } = {}) {
      this.supabase = supabaseClient || window.supabaseClient || window.sb || null;
      this.currentUser = currentUser || {};
      this.options = Object.assign({}, DEFAULT_OPTIONS, options);
      this.conversationId = null;
      this.context = {
        lastIntent: null,
        lastTicketCode: null,
        lastArea: null,
        memory: {},
        messages: []
      };
      this.synonyms = Object.assign({}, BUILTIN_SYNONYMS);
      this.ready = false;
    }

    log(...args) { if (this.options.debug) console.log('[MesaAyudaAI]', ...args); }

    async init() {
      await this.loadSynonymsFromDB();
      await this.ensureConversation();
      this.ready = true;
      return this;
    }

    async loadSynonymsFromDB() {
      if (!this.supabase) return;
      try {
        const { data, error } = await this.supabase
          .from('dt_ai_synonyms')
          .select('intent_id,term,weight,active')
          .eq('active', true)
          .limit(1000);
        if (error || !data) return;
        for (const row of data) {
          if (!row.intent_id || !row.term) continue;
          if (!this.synonyms[row.intent_id]) this.synonyms[row.intent_id] = [];
          this.synonyms[row.intent_id].push(row.term);
        }
        Object.keys(this.synonyms).forEach(k => { this.synonyms[k] = unique(this.synonyms[k]); });
      } catch (e) { this.log('No se pudieron cargar sinónimos', e); }
    }

    async ensureConversation(title = 'Conversación con Asistente IA') {
      if (this.conversationId) return this.conversationId;
      if (!this.supabase) {
        this.conversationId = 'local-' + Date.now();
        return this.conversationId;
      }
      try {
        const user = this.currentUser || {};
        const payload = {
          user_id: user.id || user.uid || user.user_id || null,
          user_name: user.name || user.full_name || user.email || 'Usuario',
          role_key: user.roleKey || user.role_key || user.role || null,
          area: user.area || null,
          title,
          context: this.context,
          status: 'active'
        };
        const { data, error } = await this.supabase.from('dt_ai_conversations').insert(payload).select('id').single();
        if (!error && data) this.conversationId = data.id;
      } catch (e) { this.log('Conversación local por error', e); }
      if (!this.conversationId) this.conversationId = 'local-' + Date.now();
      return this.conversationId;
    }

    classifyIntent(message) {
      const normalized = normalizeText(message);
      const tokens = tokenize(message);
      const scores = {};

      for (const [intent, terms] of Object.entries(this.synonyms)) {
        let score = 0;
        for (const term of terms) {
          const nt = normalizeText(term);
          if (!nt) continue;
          if (normalized.includes(nt)) score += Math.min(0.44, 0.18 + nt.length / 80);
          const termTokens = tokenize(term);
          const overlap = termTokens.filter(t => tokens.includes(t)).length;
          if (overlap) score += overlap * 0.09;
        }
        if (score > 0) scores[intent] = score;
      }

      // reglas directas
      if (/\b(dt|ticket|rad)[-\s]?\d+/i.test(message)) scores.consultar_ticket = (scores.consultar_ticket || 0) + 0.35;
      if (containsAny(message, ['aprende que','recuerda que','guarda que','ten en cuenta que'])) scores.registrar_aprendizaje = (scores.registrar_aprendizaje || 0) + 0.55;
      if (containsAny(message, ['contraseña','password','pin','token'])) scores.seguridad_datos = (scores.seguridad_datos || 0) + 0.55;

      const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
      const [intent, rawScore] = sorted[0] || ['pregunta_desconocida', 0.15];
      return { intent, confidence: Math.min(0.98, rawScore), all: sorted.slice(0,5) };
    }

    async ask(message, extra = {}) {
      await this.ensureConversation();
      const clean = String(message || '').trim();
      if (!clean) return this.buildResponse('Escríbeme tu pregunta o indícame el radicado que necesitas revisar.', { intent:'ayuda', confidence:0.3 });

      this.context.messages.push({ sender:'user', message: clean, at: new Date().toISOString() });
      this.context.messages = this.context.messages.slice(-this.options.maxContextMessages);
      await this.saveMessage('user', clean, null, null, [], extra);

      const classified = this.classifyIntent(clean);
      this.context.lastIntent = classified.intent;
      const ticketCode = extractTicketCode(clean);
      if (ticketCode) this.context.lastTicketCode = ticketCode;

      let dataAnswer = null;
      if (this.options.allowTicketDataLookup) {
        dataAnswer = await this.answerFromAppData(clean, classified.intent, ticketCode);
      }

      let knowledge = await this.searchKnowledge(clean, classified.intent);
      let learning = null;
      if (classified.intent === 'registrar_aprendizaje') {
        learning = await this.captureLearning(clean, classified);
      } else if (!knowledge.length && classified.confidence < this.options.minConfidence) {
        await this.registerUnanswered(clean, classified);
      }

      const final = this.composeAnswer(clean, classified, knowledge, dataAnswer, learning);
      const assistantMsg = await this.saveMessage('assistant', final.text, classified.intent, final.confidence, final.sources, { dataAnswer, learning });
      await this.audit('ai_answer', 'conversation', String(this.conversationId), classified.intent, final.confidence, { question: clean, sources: final.sources, dataAnswer: !!dataAnswer, messageId: assistantMsg && assistantMsg.id });
      this.context.messages.push({ sender:'assistant', message: final.text, at: new Date().toISOString() });
      this.context.messages = this.context.messages.slice(-this.options.maxContextMessages);
      return final;
    }

    async searchKnowledge(message, intent) {
      if (!this.supabase) return [];
      try {
        // 1) RPC de búsqueda
        let { data, error } = await this.supabase.rpc('dt_ai_search_knowledge', {
          p_query: message,
          p_intent: intent && intent !== 'pregunta_desconocida' ? intent : null,
          p_limit: this.options.maxKnowledgeResults
        });
        if (!error && data && data.length) return data;

        // 2) Reintento sin intención
        const retry = await this.supabase.rpc('dt_ai_search_knowledge', {
          p_query: message,
          p_intent: null,
          p_limit: this.options.maxKnowledgeResults
        });
        if (!retry.error && retry.data) return retry.data;
      } catch (e) { this.log('searchKnowledge error', e); }
      return [];
    }

    async answerFromAppData(message, intent, ticketCode) {
      if (!this.supabase) return null;
      try {
        if (['consultar_ticket','consultar_estado','consultar_responsable','resumir_ticket','auditar_ticket'].includes(intent) && (ticketCode || this.context.lastTicketCode)) {
          return await this.lookupTicket(ticketCode || this.context.lastTicketCode, intent);
        }
        if (intent === 'consultar_tickets_abiertos') return await this.countTickets({ type:'open', message });
        if (intent === 'consultar_tickets_vencidos') return await this.countTickets({ type:'overdue', message });
        if (intent === 'consultar_mis_tickets') return await this.countTickets({ type:'mine', message });
        if (intent === 'consultar_kpi') return await this.kpiSummary(message);
      } catch (e) { this.log('answerFromAppData error', e); }
      return null;
    }

    async lookupTicket(code, intent) {
      const raw = String(code || '').trim();
      if (!raw) return null;
      const variants = unique([raw, raw.replace(/[^0-9]/g,''), raw.replace(/\s+/g,'-'), raw.replace(/-/g,' ')]).filter(Boolean);
      const fields = ['radicado','code','ticket_code','id','folio','number'];
      for (const field of fields) {
        for (const v of variants) {
          try {
            const { data, error } = await this.supabase.from('dt_tickets').select('*').eq(field, v).limit(1);
            if (!error && data && data[0]) return this.formatTicketData(data[0], intent);
          } catch (_) {}
        }
      }
      return { type:'ticket_not_found', text:`No encontré un ticket con el radicado ${raw}. Verifica el número o intenta escribirlo como aparece en la mesa de ayuda.` };
    }

    formatTicketData(t, intent) {
      const code = t.radicado || t.code || t.ticket_code || t.id || 'sin radicado visible';
      const title = t.title || t.subject || t.asunto || t.description || t.descripcion || 'Solicitud sin título';
      const status = t.status || t.estado || t.statusText || 'sin estado visible';
      const area = t.area || t.category || t.categoria || t.dependencia || 'sin área visible';
      const responsible = t.assigned_to_name || t.responsible_name || t.assignedName || t.responsable || t.assigned_to || 'sin responsable visible';
      const created = t.created_at || t.fecha || t.createdAt || null;
      const updated = t.updated_at || t.updatedAt || t.last_update || null;
      const priority = t.priority || t.prioridad || 'sin prioridad visible';
      let lines = [];
      lines.push(`Encontré el ticket **${code}**.`);
      lines.push(`Estado: **${status}**.`);
      lines.push(`Área/categoría: **${area}**.`);
      lines.push(`Responsable: **${responsible}**.`);
      if (priority) lines.push(`Prioridad: **${priority}**.`);
      if (created) lines.push(`Creado: ${this.prettyDate(created)}.`);
      if (updated) lines.push(`Último movimiento: ${this.prettyDate(updated)}.`);
      if (intent === 'consultar_responsable' && responsible.includes('sin responsable')) lines.push('Recomiendo asignarlo antes de continuar la gestión.');
      if (intent === 'cerrar_ticket') lines.push('Antes de cerrar, valida respuesta final, evidencia y trazabilidad suficiente.');
      return { type:'ticket', raw:t, text:lines.join('\n') };
    }

    async countTickets({ type, message }) {
      // Este bloque es flexible porque cada app puede tener nombres distintos de campos.
      let query = this.supabase.from('dt_tickets').select('*', { count:'exact', head:false }).limit(200);
      if (type === 'mine') {
        const uid = this.currentUser.id || this.currentUser.uid || this.currentUser.user_id || this.currentUser.name;
        if (uid) {
          // No hacemos OR complejo si la tabla no tiene campos; intentamos algunos filtros de forma segura.
          try {
            const { data, error, count } = await this.supabase.from('dt_tickets').select('*', { count:'exact' }).or(`assigned_to.eq.${uid},created_by.eq.${uid},user_id.eq.${uid}`).limit(200);
            if (!error) return this.formatTicketList(data || [], count || 0, 'tus tickets activos o relacionados');
          } catch (_) {}
        }
      }
      const { data, error, count } = await query;
      if (error) return null;
      const rows = data || [];
      const activeStatus = ['abierto','abierta','activo','activa','asignado','asignada','en revision','en revisión','pendiente','en espera','respondido','respondida','proceso','en proceso'];
      const closedStatus = ['cerrado','cerrada','finalizado','finalizada','resuelto','resuelta'];
      let filtered = rows;
      if (type === 'open') {
        filtered = rows.filter(r => {
          const s = normalizeText(r.status || r.estado || r.statusText || '');
          return !closedStatus.some(c => s.includes(c)) && (s || !r.closed_at);
        });
        return this.formatTicketList(filtered, filtered.length, 'tickets abiertos o activos');
      }
      if (type === 'overdue') {
        filtered = rows.filter(r => {
          const s = normalizeText(r.status || r.estado || r.statusText || '');
          if (closedStatus.some(c => s.includes(c))) return false;
          if (r.is_overdue === true || r.overdue === true || r.vencido === true) return true;
          const due = r.due_at || r.dueDate || r.fecha_limite || r.deadline;
          return due ? new Date(due).getTime() < Date.now() : false;
        });
        return this.formatTicketList(filtered, filtered.length, 'tickets vencidos o demorados');
      }
      return { type:'tickets', text:`Encontré ${count || rows.length} tickets en la base, pero necesito un filtro más preciso para clasificarlos.` };
    }

    formatTicketList(rows, total, label) {
      const sample = (rows || []).slice(0,5).map((r, i) => {
        const code = r.radicado || r.code || r.ticket_code || r.id || `#${i+1}`;
        const status = r.status || r.estado || r.statusText || 'sin estado';
        const title = r.title || r.subject || r.asunto || r.description || r.descripcion || 'sin título';
        const responsible = r.assigned_to_name || r.responsible_name || r.responsable || r.assigned_to || 'sin responsable';
        return `- ${code}: ${title} | ${status} | ${responsible}`;
      }).join('\n');
      return {
        type:'ticket_list',
        text: `Encontré **${total} ${label}**.${sample ? '\n\nPrimeros resultados:\n' + sample : ''}`
      };
    }

    async kpiSummary(message) {
      try {
        const { data, error } = await this.supabase.from('dt_tickets').select('*').limit(1000);
        if (error || !data) return null;
        const rows = data;
        const closedWords = ['cerrado','cerrada','finalizado','finalizada','resuelto','resuelta'];
        const closed = rows.filter(r => closedWords.some(w => normalizeText(r.status || r.estado || '').includes(w))).length;
        const open = rows.length - closed;
        const overdue = rows.filter(r => r.is_overdue || r.overdue || r.vencido || (r.due_at && new Date(r.due_at) < new Date() && !closedWords.some(w => normalizeText(r.status || r.estado || '').includes(w)))).length;
        const byArea = {};
        rows.forEach(r => { const area = r.area || r.category || r.categoria || 'Sin área'; byArea[area] = (byArea[area] || 0) + 1; });
        const topAreas = Object.entries(byArea).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([a,n])=>`- ${a}: ${n}`).join('\n');
        return { type:'kpi', text:`Resumen operativo actual:\n- Total tickets revisados: **${rows.length}**\n- Abiertos/activos: **${open}**\n- Cerrados/resueltos: **${closed}**\n- Posibles vencidos: **${overdue}**\n\nÁreas con mayor volumen:\n${topAreas || '- Sin clasificación por área visible.'}` };
      } catch (e) { return null; }
    }

    async captureLearning(message, classified) {
      const normalized = message.replace(/^(aprende que|recuerda que|guarda que|ten en cuenta que|desde ahora|la regla es)\s*/i, '').trim();
      const text = normalized.length > 8 ? normalized : message;
      const keywords = tokenize(text).slice(0,12);
      const payload = {
        detected_from: 'conversation',
        conversation_id: this.isUUID(this.conversationId) ? this.conversationId : null,
        user_id: this.currentUser.id || this.currentUser.uid || this.currentUser.user_id || null,
        suggested_title: text.slice(0,80),
        suggested_knowledge: text,
        suggested_category_id: 'aprendizaje',
        suggested_intent_id: classified.intent,
        keywords,
        confidence: Math.max(0.55, classified.confidence || 0.5),
        status: 'pending_review'
      };
      if (this.supabase) {
        try { await this.supabase.from('dt_ai_learning_queue').insert(payload); } catch (e) { this.log(e); }
      }
      return { text, status:'pending_review' };
    }

    async registerUnanswered(question, classified) {
      if (!this.supabase) return;
      try {
        await this.supabase.from('dt_ai_unanswered_questions').insert({
          conversation_id: this.isUUID(this.conversationId) ? this.conversationId : null,
          user_id: this.currentUser.id || this.currentUser.uid || this.currentUser.user_id || null,
          question,
          detected_intent_id: classified.intent,
          best_score: classified.confidence || 0,
          status: 'open'
        });
      } catch(e) { this.log(e); }
    }

    composeAnswer(question, classified, knowledge, dataAnswer, learning) {
      let sources = [];
      let confidence = classified.confidence || 0.2;

      if (learning) {
        return this.buildResponse(`Listo. Lo guardé como **aprendizaje pendiente de aprobación**:\n\n“${learning.text}”\n\nTodavía no lo usaré como verdad oficial hasta que el Super Admin lo apruebe en el panel de aprendizajes.`, { intent: classified.intent, confidence: 0.9, sources:[{type:'learning_queue'}] });
      }

      if (classified.intent === 'saludar') {
        return this.buildResponse(pick([
          'Hola. Estoy listo para ayudarte con la Mesa de Ayuda de Calidad. Puedo revisar tickets, estados, responsables, evidencias, cierres, KPIs o procedimientos.',
          'Hola. Dime el radicado o cuéntame qué necesitas revisar: tickets abiertos, vencidos, responsables, cierre, evidencias o mejora continua.',
          'Hola. Estoy en modo asistente interno de calidad. Puedo orientarte con solicitudes, trazabilidad, indicadores y aprendizajes del sistema.'
        ]), { intent: classified.intent, confidence: 0.9, sources:[{type:'template'}] });
      }

      if (classified.intent === 'seguridad_datos') {
        return this.buildResponse('Por seguridad no puedo mostrar ni recuperar contraseñas, PIN, tokens, llaves o credenciales. Puedo orientarte a restablecer acceso según el flujo autorizado del sistema, pero no revelar datos sensibles.', { intent: classified.intent, confidence: 0.95, sources:[{type:'security_rule'}] });
      }

      if (dataAnswer && dataAnswer.text) {
        sources.push({ type:'app_data', detail:dataAnswer.type });
        let extra = '';
        if (knowledge && knowledge[0] && knowledge[0].answer) {
          extra = `\n\nCriterio de gestión: ${knowledge[0].answer}`;
          sources.push({ type:'knowledge_base', id:knowledge[0].id, title:knowledge[0].title });
          confidence = Math.max(confidence, 0.78);
        }
        return this.buildResponse(dataAnswer.text + extra, { intent: classified.intent, confidence, sources });
      }

      if (knowledge && knowledge.length) {
        const best = knowledge[0];
        sources.push({ type:'knowledge_base', id:best.id, title:best.title, score:best.score });
        confidence = Math.max(confidence, Math.min(0.92, 0.45 + Number(best.score || 0) / 10));
        const prefix = confidence > this.options.strongConfidence ? '' : 'Con la información disponible, ';
        let answer = prefix + best.answer;
        const suggestions = this.suggestNextActions(classified.intent);
        if (suggestions) answer += `\n\n${suggestions}`;
        return this.buildResponse(answer, { intent: classified.intent, confidence, sources });
      }

      const fallback = pick([
        'No encontré una respuesta oficial suficiente en la base de conocimiento. Dejaré esta pregunta como pendiente para alimentar el sistema y puedo ayudarte si me das un radicado, área, responsable o estado.',
        'Todavía no tengo conocimiento aprobado para responder eso con seguridad. Lo registraré como pregunta sin respuesta para revisión y aprendizaje del sistema.',
        'Necesito más contexto para responder sin inventar. Puedes indicar el radicado, el área, el responsable o describir el caso con más detalle.'
      ]);
      return this.buildResponse(fallback, { intent: 'pregunta_desconocida', confidence: 0.22, sources:[{type:'fallback'}] });
    }

    suggestNextActions(intent) {
      const map = {
        cerrar_ticket: 'Siguiente acción sugerida: revisa evidencia, respuesta final y permiso de cierre antes de cambiar el estado.',
        ampliar_espera: 'Siguiente acción sugerida: registra justificación, nueva fecha estimada y responsable del seguimiento.',
        escalar_ticket: 'Siguiente acción sugerida: documenta la causa del escalamiento y notifica al responsable superior.',
        agregar_evidencia: 'Siguiente acción sugerida: adjunta el soporte y deja un comentario explicando por qué prueba la gestión realizada.',
        consultar_tickets_vencidos: 'Siguiente acción sugerida: prioriza los casos sin justificación de espera y revisa responsables con mayor acumulación.',
        sugerir_mejora: 'Siguiente acción sugerida: convierte la causa raíz en acción con responsable, fecha y evidencia de cierre.',
        error_sistema: 'Siguiente acción sugerida: verifica sesión, permisos, conexión y que la tabla correspondiente exista en Supabase.'
      };
      return map[intent] || '';
    }

    buildResponse(text, meta = {}) {
      return {
        text,
        intent: meta.intent || null,
        confidence: meta.confidence || 0.5,
        sources: meta.sources || [],
        conversationId: this.conversationId,
        createdAt: new Date().toISOString()
      };
    }

    async saveMessage(sender, message, intent, confidence, sources, metadata) {
      if (!this.supabase || !this.isUUID(this.conversationId)) return null;
      try {
        const payload = { conversation_id:this.conversationId, sender, message, intent_id:intent, confidence, sources:sources || [], metadata:metadata || {} };
        const { data, error } = await this.supabase.from('dt_ai_messages').insert(payload).select('id').single();
        return error ? null : data;
      } catch (e) { this.log('saveMessage error', e); return null; }
    }

    async audit(action, entityType, entityId, intent, confidence, details) {
      if (!this.supabase) return;
      try {
        await this.supabase.from('dt_ai_audit_log').insert({
          actor_user_id: this.currentUser.id || this.currentUser.uid || this.currentUser.user_id || null,
          actor_name: this.currentUser.name || this.currentUser.email || 'Usuario',
          action,
          entity_type: entityType,
          entity_id: entityId,
          intent_id: intent,
          confidence,
          details: details || {}
        });
      } catch(e) { this.log('audit error', e); }
    }

    prettyDate(value) {
      try { return new Date(value).toLocaleString('es-CO'); } catch(e) { return String(value); }
    }

    isUUID(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '')); }
  }

  window.MesaAyudaAI = MesaAyudaAI;
})();
