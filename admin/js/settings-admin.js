// =========================================================
// Admin Settings
// =========================================================

let freezeDateField = null;

async function init() {
  const adminUser = await requireAdmin();
  if (!adminUser) return;

  initAdminShell('settings.html', adminUser);
  initAllCustomSelects();
  freezeDateField = initDateField('freezeDate');

  document.getElementById('adminEmail').textContent = adminUser.email;
  document.getElementById('adminCreated').textContent = adminUser.created_at ? formatDate(adminUser.created_at) : '—';

  await Promise.all([loadBusinessSettings(), loadBlockedDates()]);

  document.getElementById('pageLoading').style.display = 'none';
  document.getElementById('pageContent').style.display = 'block';

  document.getElementById('settingsLogout').addEventListener('click', adminSignOut);
  document.getElementById('businessForm').addEventListener('submit', saveBusinessSettings);
  document.getElementById('freezeDateForm').addEventListener('submit', submitFreezeDate);
}

async function loadBusinessSettings() {
  const { data, error } = await supabaseClient
    .from('business_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load business settings:', error);
    return;
  }

  document.getElementById('bizName').value = data.business_name || '';
  document.getElementById('bizPhone').value = data.phone || '';
  document.getElementById('bizWhatsapp').value = data.whatsapp_number || '';
  document.getElementById('bizArea').value = data.service_area || '';
  document.getElementById('bizHours').value = data.working_hours || '';
}

async function saveBusinessSettings(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  const { error } = await supabaseClient
    .from('business_settings')
    .update({
      business_name: document.getElementById('bizName').value.trim(),
      phone: document.getElementById('bizPhone').value.trim(),
      whatsapp_number: document.getElementById('bizWhatsapp').value.trim(),
      service_area: document.getElementById('bizArea').value.trim(),
      working_hours: document.getElementById('bizHours').value.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  submitBtn.disabled = false;
  submitBtn.textContent = 'Save Business Info';

  if (error) {
    showToast('Failed to save: ' + error.message, 'error');
    return;
  }

  showToast('Business info saved.');
}

document.addEventListener('DOMContentLoaded', init);

// ---------------- Blocked Dates ----------------
async function loadBlockedDates() {
  const { data, error } = await supabaseClient
    .from('blocked_dates')
    .select('*')
    .order('blocked_date', { ascending: true });

  const tbody = document.getElementById('blockedDatesBody');
  const emptyEl = document.getElementById('blockedDatesEmpty');
  const tableEl = document.getElementById('blockedDatesTable');

  if (error || !data || data.length === 0) {
    tableEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  tableEl.style.display = 'table';
  emptyEl.style.display = 'none';

  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${formatDate(row.blocked_date)}</td>
      <td>${row.reason || '—'}</td>
      <td><button class="expense-delete-btn" data-unfreeze="${row.id}">Unfreeze</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-unfreeze]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Unfreeze this date? Clients will be able to book it again.')) return;
      const { error: deleteError } = await supabaseClient
        .from('blocked_dates')
        .delete()
        .eq('id', btn.dataset.unfreeze);

      if (deleteError) {
        showToast('Failed to unfreeze: ' + deleteError.message, 'error');
        return;
      }
      showToast('Date unfrozen.');
      await loadBlockedDates();
    });
  });
}

async function submitFreezeDate(e) {
  e.preventDefault();
  const btn = document.getElementById('freezeSubmit');
  const dateValue = document.getElementById('freezeDate').value;

  if (!dateValue) {
    showToast('Pick a date to freeze first.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Freezing…';

  const { error } = await supabaseClient.from('blocked_dates').insert({
    blocked_date: dateValue,
    reason: document.getElementById('freezeReason').value.trim() || null,
  });

  btn.disabled = false;
  btn.textContent = 'Freeze Date';

  if (error) {
    // Unique constraint violation = this date is already frozen
    const message = error.code === '23505' ? 'That date is already frozen.' : error.message;
    showToast('Failed to freeze date: ' + message, 'error');
    return;
  }

  showToast('Date frozen — no bookings can be made that day.');
  document.getElementById('freezeReason').value = '';
  if (freezeDateField) freezeDateField.reset();
  await loadBlockedDates();
}
