
/* Panel administrativo IA Nivel 1 */
(function(){
  'use strict';

  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function esc(s){ return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  class AIPanel {
    constructor({ supabaseClient, ai, currentUser = {} } = {}) {
      this.supabase = supabaseClient || window.supabaseClient || window.sb || null;
      this.ai = ai || null;
      this.currentUser = currentUser || {};
      this.state = { tab:'chat', knowledge:[], learning:[], unanswered:[], audit:[] };
    }

    async init() {
      this.bind();
      if (!this.ai && window.MesaAyudaAI) {
        this.ai = await new window.MesaAyudaAI({ supabaseClient:this.supabase, currentUser:this.currentUser }).init();
      }
      await this.refreshAll();
      this.render();
    }

    bind() {
      document.addEventListener('click', async (e) => {
        const tab = e.target.closest('[data-ai-tab]');
        if (tab) { this.state.tab = tab.dataset.aiTab; this.render(); return; }
        const send = e.target.closest('[data-ai-send]');
        if (send) await this.sendChat();
        const approve = e.target.closest('[data-learn-approve]');
        if (approve) await this.approveLearning(approve.dataset.learnApprove);
        const reject = e.target.closest('[data-learn-reject]');
        if (reject) await this.rejectLearning(reject.dataset.learnReject);
        const saveKb = e.target.closest('[data-save-kb]');
        if (saveKb) await this.saveKnowledge();
        const refresh = e.target.closest('[data-refresh-ai]');
        if (refresh) { await this.refreshAll(); this.render(); }
      });
      document.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && e.ctrlKey && e.target.matches('#aiQuestion')) await this.sendChat();
      });
    }

    async refreshAll() {
      await Promise.all([this.loadKnowledge(), this.loadLearning(), this.loadUnanswered(), this.loadAudit()]);
    }

    async loadKnowledge() {
      if (!this.supabase) return;
      const { data } = await this.supabase.from('v_dt_ai_knowledge_panel').select('*').order('updated_at', { ascending:false }).limit(100);
      this.state.knowledge = data || [];
    }

    async loadLearning() {
      if (!this.supabase) return;
      const { data } = await this.supabase.from('dt_ai_learning_queue').select('*').order('created_at', { ascending:false }).limit(100);
      this.state.learning = data || [];
    }

    async loadUnanswered() {
      if (!this.supabase) return;
      const { data } = await this.supabase.from('dt_ai_unanswered_questions').select('*').order('created_at', { ascending:false }).limit(100);
      this.state.unanswered = data || [];
    }

    async loadAudit() {
      if (!this.supabase) return;
      const { data } = await this.supabase.from('dt_ai_audit_log').select('*').order('created_at', { ascending:false }).limit(80);
      this.state.audit = data || [];
    }

    render() {
      const root = $('#aiPanelRoot');
      if (!root) return;
      root.innerHTML = `
        <section class="ai-shell">
          <header class="ai-header">
            <div>
              <p class="ai-eyebrow">Mesa de Ayuda de Calidad</p>
              <h1>Cerebro IA Nivel 1</h1>
              <p>Asistente sin API paga, con base de conocimiento, memoria, aprendizaje pendiente y consulta interna.</p>
            </div>
            <button class="ai-btn ghost" data-refresh-ai>Actualizar</button>
          </header>
          <nav class="ai-tabs">
            ${this.tabButton('chat','Chat asistente')}
            ${this.tabButton('knowledge','Base de conocimiento')}
            ${this.tabButton('learning','Aprendizajes')}
            ${this.tabButton('unanswered','Sin respuesta')}
            ${this.tabButton('audit','Auditoría')}
            ${this.tabButton('newkb','Nueva respuesta')}
          </nav>
          <main class="ai-main">${this.renderTab()}</main>
        </section>`;
    }

    tabButton(id, label){ return `<button class="ai-tab ${this.state.tab===id?'active':''}" data-ai-tab="${id}">${label}</button>`; }

    renderTab(){
      if (this.state.tab === 'chat') return this.renderChat();
      if (this.state.tab === 'knowledge') return this.renderKnowledge();
      if (this.state.tab === 'learning') return this.renderLearning();
      if (this.state.tab === 'unanswered') return this.renderUnanswered();
      if (this.state.tab === 'audit') return this.renderAudit();
      if (this.state.tab === 'newkb') return this.renderNewKb();
      return '';
    }

    renderChat(){
      return `<div class="ai-card">
        <h2>Chat interno</h2>
        <div id="aiChatLog" class="ai-chat-log"></div>
        <textarea id="aiQuestion" class="ai-textarea" placeholder="Ejemplo: ¿Cuántos tickets abiertos hay? / Aprende que los tickets sin evidencia no deben cerrarse..."></textarea>
        <div class="ai-row"><button class="ai-btn" data-ai-send>Enviar</button><span class="ai-hint">Ctrl + Enter para enviar</span></div>
      </div>`;
    }

    renderKnowledge(){
      const rows = this.state.knowledge.map(k => `<tr><td>${esc(k.title)}</td><td>${esc(k.category_name)}</td><td>${esc(k.intent_id)}</td><td>${k.priority}</td><td>${k.requires_data_lookup?'Sí':'No'}</td><td>${esc(k.status)}</td></tr>`).join('');
      return `<div class="ai-card"><h2>Base de conocimiento</h2><p class="ai-muted">Últimos 100 registros aprobados o cargados.</p><div class="ai-table-wrap"><table class="ai-table"><thead><tr><th>Título</th><th>Categoría</th><th>Intención</th><th>Prioridad</th><th>Datos</th><th>Estado</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Sin registros visibles.</td></tr>'}</tbody></table></div></div>`;
    }

    renderLearning(){
      const cards = this.state.learning.map(l => `<article class="ai-item"><div><strong>${esc(l.suggested_title || 'Aprendizaje pendiente')}</strong><p>${esc(l.suggested_knowledge)}</p><small>Estado: ${esc(l.status)} · Confianza: ${Number(l.confidence||0).toFixed(2)}</small></div><div class="ai-actions"><button class="ai-btn small" data-learn-approve="${esc(l.id)}">Aprobar</button><button class="ai-btn small ghost" data-learn-reject="${esc(l.id)}">Rechazar</button></div></article>`).join('');
      return `<div class="ai-card"><h2>Aprendizajes pendientes</h2>${cards || '<p class="ai-muted">No hay aprendizajes pendientes.</p>'}</div>`;
    }

    renderUnanswered(){
      const cards = this.state.unanswered.map(u => `<article class="ai-item"><div><strong>${esc(u.question)}</strong><p>Intención detectada: ${esc(u.detected_intent_id)} · Puntaje: ${Number(u.best_score||0).toFixed(2)}</p><small>${esc(u.created_at)}</small></div></article>`).join('');
      return `<div class="ai-card"><h2>Preguntas sin respuesta</h2>${cards || '<p class="ai-muted">No hay preguntas sin respuesta.</p>'}</div>`;
    }

    renderAudit(){
      const rows = this.state.audit.map(a => `<tr><td>${esc(a.created_at)}</td><td>${esc(a.actor_name)}</td><td>${esc(a.action)}</td><td>${esc(a.intent_id)}</td><td>${Number(a.confidence||0).toFixed(2)}</td></tr>`).join('');
      return `<div class="ai-card"><h2>Auditoría IA</h2><div class="ai-table-wrap"><table class="ai-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Intención</th><th>Confianza</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin auditoría visible.</td></tr>'}</tbody></table></div></div>`;
    }

    renderNewKb(){
      return `<div class="ai-card"><h2>Nueva respuesta oficial</h2>
        <div class="ai-grid two">
          <label>Título<input id="kbTitle" class="ai-input"></label>
          <label>Categoría<input id="kbCategory" class="ai-input" value="uso_general"></label>
          <label>Intención<input id="kbIntent" class="ai-input" value="buscar_conocimiento"></label>
          <label>Palabras clave<input id="kbKeywords" class="ai-input" placeholder="separadas por coma"></label>
        </div>
        <label>Pregunta<input id="kbQuestion" class="ai-input"></label>
        <label>Respuesta<textarea id="kbAnswer" class="ai-textarea"></textarea></label>
        <button class="ai-btn" data-save-kb>Guardar como conocimiento aprobado</button>
      </div>`;
    }

    async sendChat(){
      const input = $('#aiQuestion');
      const log = $('#aiChatLog');
      if (!input || !this.ai) return;
      const question = input.value.trim();
      if (!question) return;
      input.value = '';
      log.insertAdjacentHTML('beforeend', `<div class="ai-bubble user">${esc(question)}</div>`);
      const answer = await this.ai.ask(question);
      log.insertAdjacentHTML('beforeend', `<div class="ai-bubble bot">${this.markdownLite(answer.text)}<div class="ai-meta">Intención: ${esc(answer.intent)} · Confianza: ${Number(answer.confidence||0).toFixed(2)}</div></div>`);
      log.scrollTop = log.scrollHeight;
      await this.refreshAll();
    }

    async approveLearning(id){
      if (!this.supabase) return;
      const item = this.state.learning.find(x => String(x.id) === String(id));
      if (!item) return;
      const kbId = 'kb_learn_' + String(id).replace(/-/g,'').slice(0,16);
      await this.supabase.from('dt_ai_knowledge_base').insert({
        id: kbId,
        category_id: item.suggested_category_id || 'aprendizaje',
        intent_id: item.suggested_intent_id || 'buscar_conocimiento',
        title: item.suggested_title || 'Aprendizaje aprobado',
        question: item.suggested_title || item.suggested_knowledge.slice(0,100),
        answer: item.suggested_knowledge,
        keywords: item.keywords || [],
        priority: 7,
        confidence_base: item.confidence || 0.75,
        requires_data_lookup: false,
        source_type: 'aprendizaje_aprobado',
        approved: true,
        status: 'active',
        created_by: this.currentUser.id || this.currentUser.name || 'admin',
        approved_by: this.currentUser.id || this.currentUser.name || 'admin'
      });
      await this.supabase.from('dt_ai_learning_queue').update({ status:'approved', reviewed_by:this.currentUser.name || this.currentUser.id || 'admin', reviewed_at:new Date().toISOString() }).eq('id', id);
      await this.refreshAll(); this.render();
    }

    async rejectLearning(id){
      if (!this.supabase) return;
      await this.supabase.from('dt_ai_learning_queue').update({ status:'rejected', reviewed_by:this.currentUser.name || this.currentUser.id || 'admin', reviewed_at:new Date().toISOString() }).eq('id', id);
      await this.refreshAll(); this.render();
    }

    async saveKnowledge(){
      if (!this.supabase) return;
      const keywords = ($('#kbKeywords').value || '').split(',').map(x=>x.trim()).filter(Boolean);
      const id = 'kb_manual_' + Date.now();
      await this.supabase.from('dt_ai_knowledge_base').insert({
        id,
        category_id: $('#kbCategory').value || 'uso_general',
        intent_id: $('#kbIntent').value || 'buscar_conocimiento',
        title: $('#kbTitle').value || 'Conocimiento manual',
        question: $('#kbQuestion').value || '',
        answer: $('#kbAnswer').value || '',
        keywords,
        priority: 8,
        confidence_base: 0.85,
        requires_data_lookup: false,
        source_type: 'manual_admin',
        approved: true,
        status: 'active',
        created_by: this.currentUser.id || this.currentUser.name || 'admin',
        approved_by: this.currentUser.id || this.currentUser.name || 'admin'
      });
      await this.refreshAll(); this.state.tab='knowledge'; this.render();
    }

    markdownLite(text){
      return esc(text).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    }
  }

  window.MesaAyudaAIPanel = AIPanel;
})();
