
frappe.pages['alphax-budget-copilot'].on_page_load = function(wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __('AlphaX Budget Copilot'),
    single_column: true
  });

  const $container = $(`
    <div class="p-3">
      <div class="form-group">
        <label>${__('Ask a budget question')}</label>
        <textarea class="form-control" rows="3" placeholder="${__('e.g. Why is Branch Riyadh overspending this month?')}"></textarea>
      </div>
      <div class="mt-2">
        <button class="btn btn-primary">${__('Ask')}</button>
        <button class="btn btn-default ml-2">${__('Clear')}</button>
      </div>
      <hr/>
      <pre class="small" style="white-space: pre-wrap;"></pre>
      <div class="text-muted small mt-2">
        ${__('Tip: Copilot answers are based on budget distributions and recent accounting / purchasing data.')}
      </div>
    </div>
  `).appendTo(page.body);

  const $q = $container.find('textarea');
  const $out = $container.find('pre');

  $container.find('.btn-primary').on('click', async () => {
    const question = ($q.val() || '').trim();
    if (!question) {
      frappe.msgprint(__('Please type a question.'));
      return;
    }
    $out.text(__('Thinking...'));
    try {
      const r = await frappe.call({
        method: 'alphax_budget.ai.copilot.ask',
        args: { question }
      });
      $out.text((r && r.message) ? r.message : __('No response.'));
    } catch (e) {
      $out.text(e.message || __('Error'));
    }
  });

  $container.find('.btn-default').on('click', () => {
    $q.val('');
    $out.text('');
  });
}
