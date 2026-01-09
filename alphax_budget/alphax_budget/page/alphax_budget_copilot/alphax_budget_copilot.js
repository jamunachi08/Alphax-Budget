frappe.pages['alphax-budget-copilot'].on_page_load = function(wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __('AlphaX Budget Copilot'),
    single_column: true
  });

  const $body = $(`
    <div class="p-4">
      <div class="mb-2 text-muted">
        ${__('Ask budget questions and get AI insights (configure in AlphaX Budget Settings).')}
      </div>

      <div class="form-group">
        <textarea class="form-control" style="min-height: 120px" placeholder="${__('Type your question...')}"></textarea>
      </div>

      <button class="btn btn-primary">${__('Ask')}</button>

      <hr/>

      <pre class="border rounded p-3 bg-light" style="white-space: pre-wrap"></pre>
    </div>
  `).appendTo(page.body);

  const $ta = $body.find('textarea');
  const $out = $body.find('pre');

  $body.find('button').on('click', () => {
    const q = ($ta.val() || '').trim();
    if (!q) {
      frappe.msgprint(__('Please type a question.'));
      return;
    }

    $out.text(__('Thinking...'));

    frappe.call({
      method: 'alphax_budget.ai.copilot.ask',
      args: { question: q },
      callback: (r) => {
        $out.text((r && r.message) ? r.message : __('No response'));
      }
    });
  });
};
