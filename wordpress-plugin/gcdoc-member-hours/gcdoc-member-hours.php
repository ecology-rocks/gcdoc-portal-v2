<?php
/**
 * Plugin Name: GCDOC Member Hours
 * Description: Shows the logged-in WordPress member's volunteer hours/log history, pulled from the GCDOC portal.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit; // No direct access.
}

// Set these in wp-config.php - never hard-code the secret here.
// define('GCDOC_REPORT_ENDPOINT', 'https://your-netlify-site.netlify.app/.netlify/functions/member-report');
// define('GCDOC_DIRECTORY_ENDPOINT', 'https://your-netlify-site.netlify.app/.netlify/functions/member-directory');
// define('GCDOC_LOG_SUBMIT_ENDPOINT', 'https://your-netlify-site.netlify.app/.netlify/functions/member-log-submit');
// define('GCDOC_REPORT_SECRET', 'a-long-random-shared-secret');

define('GCDOC_DUES_PAGE_URL', 'https://gcdoc.com/product/membership-dues/');

function gcdoc_call_report_endpoint($endpoint, $body) {
    if (!defined('GCDOC_REPORT_SECRET')) {
        return new WP_Error('gcdoc_config', 'GCDOC_REPORT_SECRET is not configured in wp-config.php.');
    }

    $response = wp_remote_post($endpoint, [
        'timeout' => 15,
        'headers' => [
            'Content-Type' => 'application/json',
            'X-Report-Secret' => GCDOC_REPORT_SECRET,
        ],
        'body' => wp_json_encode($body),
    ]);

    if (is_wp_error($response)) {
        return $response;
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code !== 200) {
        return new WP_Error('gcdoc_report_error', 'Request failed (' . $code . ').');
    }

    $data = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($data)) {
        return new WP_Error('gcdoc_report_parse', 'Unexpected response from report service.');
    }

    return $data;
}

function gcdoc_fetch_member_report($email) {
    if (!defined('GCDOC_REPORT_ENDPOINT')) {
        return new WP_Error('gcdoc_config', 'GCDOC_REPORT_ENDPOINT is not configured in wp-config.php.');
    }
    return gcdoc_call_report_endpoint(GCDOC_REPORT_ENDPOINT, ['email' => $email]);
}

function gcdoc_fetch_member_directory() {
    if (!defined('GCDOC_DIRECTORY_ENDPOINT')) {
        return new WP_Error('gcdoc_config', 'GCDOC_DIRECTORY_ENDPOINT is not configured in wp-config.php.');
    }
    return gcdoc_call_report_endpoint(GCDOC_DIRECTORY_ENDPOINT, []);
}

function gcdoc_submit_member_log($email, $date, $activity, $type, $clock_hours) {
    if (!defined('GCDOC_LOG_SUBMIT_ENDPOINT')) {
        return new WP_Error('gcdoc_config', 'GCDOC_LOG_SUBMIT_ENDPOINT is not configured in wp-config.php.');
    }
    return gcdoc_call_report_endpoint(GCDOC_LOG_SUBMIT_ENDPOINT, [
        'email' => $email,
        'date' => $date,
        'activity' => $activity,
        'type' => $type,
        'clockHours' => $clock_hours,
    ]);
}

// Dues schedule is based on membership type and hours logged in the current fiscal year.
function gcdoc_calculate_dues($membership_type, $hours) {
    $type = strtolower(trim($membership_type));

    if (in_array($type, ['applicant', 'lifetime'], true)) {
        return ['amount' => 0, 'eligible' => true, 'note' => ''];
    }

    if ($type === 'associate') {
        return ['amount' => 20, 'eligible' => true, 'note' => ''];
    }

    if (in_array($type, ['regular', 'household'], true)) {
        if ($hours < 20) {
            return [
                'amount' => null,
                'eligible' => false,
                'note' => 'Not eligible for Regular membership dues at this hour level. You may choose $20 Associate Membership instead.',
            ];
        }
        if ($hours < 30) {
            return ['amount' => 50, 'eligible' => true, 'note' => ''];
        }
        if ($hours < 40) {
            return ['amount' => 40, 'eligible' => true, 'note' => ''];
        }
        if ($hours < 50) {
            return ['amount' => 30, 'eligible' => true, 'note' => ''];
        }
        return ['amount' => 15, 'eligible' => true, 'note' => ''];
    }

    // Unknown/inactive/nonmember types have no dues schedule to show.
    return null;
}

// Shared by any shortcode that needs the current user's report (hours, dues owed, etc.)
function gcdoc_get_member_report_cached() {
    if (!is_user_logged_in()) {
        return new WP_Error('gcdoc_not_logged_in', 'Please log in to view this content.');
    }

    $user = wp_get_current_user();
    $email = sanitize_email($user->user_email);

    $cache_key = 'gcdoc_hours_' . md5($email);
    $report = get_transient($cache_key);

    if ($report === false) {
        $report = gcdoc_fetch_member_report($email);
        if (is_wp_error($report)) {
            return $report;
        }
        set_transient($cache_key, $report, 5 * MINUTE_IN_SECONDS);
    }

    return $report;
}

function gcdoc_render_dues_table($membership_type, $hours) {
    $rows = [
        ['range' => '< 20 hrs', 'amount' => 'Not eligible &mdash; choose $20 Associate Membership instead', 'min' => 0, 'max' => 20],
        ['range' => '20 - 29.75 hrs', 'amount' => '$50', 'min' => 20, 'max' => 30],
        ['range' => '30 - 39.75 hrs', 'amount' => '$40', 'min' => 30, 'max' => 40],
        ['range' => '40 - 49.75 hrs', 'amount' => '$30', 'min' => 40, 'max' => 50],
        ['range' => '50+ hrs', 'amount' => '$15', 'min' => 50, 'max' => INF],
    ];

    ob_start();
    ?>
    <table class="gcdoc-dues-table">
        <thead>
            <tr><th>Hours Logged (Regular/Household)</th><th>Dues</th></tr>
        </thead>
        <tbody>
            <?php foreach ($rows as $row) : ?>
                <?php $is_current = strtolower(trim($membership_type)) === 'regular' || strtolower(trim($membership_type)) === 'household'; ?>
                <?php $is_current = $is_current && $hours >= $row['min'] && $hours < $row['max']; ?>
                <tr class="<?php echo $is_current ? 'gcdoc-dues-current' : ''; ?>">
                    <td><?php echo esc_html($row['range']); ?></td>
                    <td><?php echo wp_kses_post($row['amount']); ?></td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
    <?php
    return ob_get_clean();
}



function gcdoc_member_hours_shortcode() {
    $report = gcdoc_get_member_report_cached();
    if (is_wp_error($report)) {
        if ($report->get_error_code() === 'gcdoc_not_logged_in') {
            return '<p>Please log in to view your volunteer hours.</p>';
        }
        return '<p>Unable to load your hours right now. Please try again later.</p>';
    }

    ob_start();
    $membership_type = $report['membershipType'] ?? '';
    $current_fy_hours = $report['duesFiscalYearHours'] ?? 0;
    $dues = gcdoc_calculate_dues($membership_type, $current_fy_hours);
    ?>
    <div class="gcdoc-hours-report">
        <?php if ($dues !== null) : ?>
            <div class="gcdoc-dues-summary">
                <h3>Dues (<?php echo esc_html($report['duesFiscalYear'] ?? 'Current Year'); ?>)</h3>
                <?php if ($dues['eligible']) : ?>
                    <p class="gcdoc-dues-amount">
                        Based on <?php echo esc_html($current_fy_hours); ?> hrs logged this fiscal year, your dues are
                        <strong><?php echo $dues['amount'] === 0 ? '$0' : '$' . esc_html($dues['amount']); ?></strong>.
                    </p>
                <?php else : ?>
                    <p class="gcdoc-dues-amount gcdoc-dues-ineligible">
                        Based on <?php echo esc_html($current_fy_hours); ?> hrs logged this fiscal year:
                        <?php echo wp_kses_post($dues['note']); ?>
                    </p>
                <?php endif; ?>
                <?php echo gcdoc_render_dues_table($membership_type, $current_fy_hours); ?>
                <?php if ($dues['amount'] !== 0) : ?>
                    <p class="gcdoc-dues-pay">
                        <a href="<?php echo esc_url(GCDOC_DUES_PAGE_URL); ?>" class="gcdoc-pay-dues-btn">Pay Your Dues</a>
                    </p>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <h3>Volunteer Hours Summary</h3>
        <p><strong>All-time hours:</strong> <?php echo esc_html($report['totalHours']); ?></p>

        <?php if (empty($report['fiscalYears'])) : ?>
            <p>No logged hours yet.</p>
        <?php else : ?>
            <?php foreach ($report['fiscalYears'] as $index => $fy) : ?>
                <details class="gcdoc-fy-section" <?php echo $index === 0 ? 'open' : ''; ?>>
                    <summary>
                        <strong><?php echo esc_html($fy['label']); ?></strong>
                        &mdash; <?php echo esc_html($fy['hours']); ?> hrs,
                        <?php echo esc_html($fy['vouchers']); ?> voucher<?php echo intval($fy['vouchers']) === 1 ? '' : 's'; ?>
                    </summary>
                    <?php if (empty($fy['logs'])) : ?>
                        <p>No logged hours for this fiscal year.</p>
                    <?php else : ?>
                        <table class="gcdoc-hours-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Activity</th>
                                    <th>Type</th>
                                    <th>Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($fy['logs'] as $log) : ?>
                                    <tr>
                                        <td><?php echo esc_html(date_i18n(get_option('date_format'), strtotime($log['date']))); ?></td>
                                        <td><?php echo esc_html($log['activity']); ?></td>
                                        <td><?php echo esc_html($log['type']); ?></td>
                                        <td><?php echo esc_html($log['hours']); ?></td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>
                </details>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('gcdoc_hours', 'gcdoc_member_hours_shortcode');

// A short bolded line for the dues product page itself: "Your dues owed are $X..."
function gcdoc_dues_owed_shortcode() {
    $report = gcdoc_get_member_report_cached();
    if (is_wp_error($report)) {
        if ($report->get_error_code() === 'gcdoc_not_logged_in') {
            return '<p class="gcdoc-dues-owed">Please log in to see your dues amount.</p>';
        }
        return '<p class="gcdoc-dues-owed">Unable to load your dues amount right now. Please try again later.</p>';
    }

    $membership_type = $report['membershipType'] ?? '';
    $current_fy_hours = $report['duesFiscalYearHours'] ?? 0;
    $dues = gcdoc_calculate_dues($membership_type, $current_fy_hours);

    if ($dues === null) {
        return '';
    }

    if (!$dues['eligible']) {
        return '<p class="gcdoc-dues-owed">' . wp_kses_post($dues['note']) . '</p>';
    }

    $amount = $dues['amount'] === 0 ? '$0' : '$' . esc_html($dues['amount']);

    return '<p class="gcdoc-dues-owed"><strong>Your dues owed are ' . $amount . '. Please select the correct option on the form below.</strong></p>';
}
add_shortcode('gcdoc_dues_owed', 'gcdoc_dues_owed_shortcode');

function gcdoc_member_directory_shortcode() {
    if (!is_user_logged_in()) {
        return '<p>Please log in to view the member directory.</p>';
    }

    // Shared across all users since the directory content is the same for everyone.
    // Append ?gcdoc_refresh=1 to the page URL (as an admin) to bypass the cache.
    $cache_key = 'gcdoc_directory_all';
    $force_refresh = current_user_can('manage_options') && isset($_GET['gcdoc_refresh']);
    $data = $force_refresh ? false : get_transient($cache_key);

    if ($data === false) {
        $data = gcdoc_fetch_member_directory();
        if (is_wp_error($data)) {
            return '<p>Unable to load the member directory right now. Please try again later.</p>';
        }
        set_transient($cache_key, $data, 5 * MINUTE_IN_SECONDS);
    }

    $members = $data['members'] ?? [];

    ob_start();
    ?>
    <div class="gcdoc-directory">
        <h3>Member Directory</h3>
        <input
            type="text"
            class="gcdoc-directory-search"
            placeholder="Search by name..."
            onkeyup="gcdocFilterDirectory(this)"
        >
        <?php if (empty($members)) : ?>
            <p>No members found.</p>
        <?php else : ?>
            <div class="gcdoc-directory-grid">
                <?php foreach ($members as $m) : ?>
                    <?php
                    // Prefer the actual WP_User object so plugins that add local avatars
                    // (Simple Local Avatars, WP User Avatar, etc.) can resolve them by user ID.
                    $wp_user = get_user_by('email', $m['email']);
                    $avatar_id = $wp_user ? $wp_user->ID : $m['email'];
                    ?>
                    <div class="gcdoc-member-card">
                        <div class="gcdoc-member-header">
                            <?php echo get_avatar($avatar_id, 48, 'mp', '', ['class' => 'gcdoc-member-avatar']); ?>
                            <div>
                                <div class="gcdoc-member-name"><?php echo esc_html($m['lastName'] . ', ' . $m['firstName']); ?></div>
                                <?php if (!empty($m['familyName'])) : ?>
                                    <div class="gcdoc-member-family"><?php echo esc_html($m['familyName']); ?></div>
                                <?php endif; ?>
                            </div>
                        </div>
                        <div class="gcdoc-member-type">
                            <?php echo esc_html($m['membershipType']); ?>
                            <?php if (!empty($m['joined'])) : ?>
                                &middot; Joined <?php echo esc_html($m['joined']); ?>
                            <?php endif; ?>
                        </div>
                        <div class="gcdoc-member-contact">
                            <?php if (!empty($m['phone'])) : ?>
                                <span class="gcdoc-member-phone"><?php echo esc_html($m['phone']); ?></span>
                            <?php endif; ?>
                            <a href="mailto:<?php echo esc_attr($m['email']); ?>"><?php echo esc_html($m['email']); ?></a>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
    <script>
        function gcdocFilterDirectory(input) {
            var filter = input.value.toLowerCase();
            var cards = input.closest('.gcdoc-directory').querySelectorAll('.gcdoc-member-card');
            cards.forEach(function (card) {
                card.style.display = card.textContent.toLowerCase().indexOf(filter) > -1 ? '' : 'none';
            });
        }
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('gcdoc_directory', 'gcdoc_member_directory_shortcode');

function gcdoc_log_hours_shortcode() {
    if (!is_user_logged_in()) {
        return '<p>Please log in to log volunteer hours.</p>';
    }

    $nonce = wp_create_nonce('gcdoc_log_hours');
    $today = date_i18n('Y-m-d');
    ob_start();
    ?>
    <div class="gcdoc-log-hours">
        <form id="gcdoc-log-hours-form">
            <input type="hidden" name="nonce" value="<?php echo esc_attr($nonce); ?>">

            <div class="gcdoc-form-row">
                <label for="gcdoc-log-date">Date</label>
                <input type="date" id="gcdoc-log-date" name="date" value="<?php echo esc_attr($today); ?>" max="<?php echo esc_attr($today); ?>" required>
            </div>

            <div class="gcdoc-form-row">
                <label for="gcdoc-log-activity">Activity</label>
                <input type="text" id="gcdoc-log-activity" name="activity" placeholder="e.g. Trial helper, Grounds cleanup" required>
            </div>

            <div class="gcdoc-form-row">
                <label for="gcdoc-log-type">Type</label>
                <select id="gcdoc-log-type" name="type">
                    <option value="STANDARD">Standard / Regular (1x)</option>
                    <option value="MAINT">Cleaning / Maintenance (2x + Blue Ribbon)</option>
                    <option value="SETUP">Trial Setup / Teardown (2x)</option>
                </select>
            </div>

            <div class="gcdoc-form-row">
                <label for="gcdoc-log-hours">Hours Worked</label>
                <input type="number" id="gcdoc-log-hours" name="clockHours" step="0.25" min="0.25" required>
            </div>

            <button type="submit" class="gcdoc-log-submit">Submit Hours</button>
            <p class="gcdoc-log-message" role="status"></p>
        </form>
    </div>
    <script>
        (function () {
            var form = document.getElementById('gcdoc-log-hours-form');
            if (!form) return;

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var msg = form.querySelector('.gcdoc-log-message');
                var button = form.querySelector('.gcdoc-log-submit');
                msg.textContent = '';
                msg.className = 'gcdoc-log-message';
                button.disabled = true;
                button.textContent = 'Submitting...';

                var data = new FormData(form);
                data.append('action', 'gcdoc_log_hours');

                fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
                    method: 'POST',
                    credentials: 'same-origin',
                    body: data,
                })
                    .then(function (res) { return res.json(); })
                    .then(function (json) {
                        button.disabled = false;
                        button.textContent = 'Submit Hours';
                        if (json.success) {
                            msg.textContent = 'Hours submitted for approval. Thank you!';
                            msg.className = 'gcdoc-log-message gcdoc-log-success';
                            form.reset();
                            document.getElementById('gcdoc-log-date').value = '<?php echo esc_js($today); ?>';
                        } else {
                            msg.textContent = (json.data && json.data.message) || 'Something went wrong. Please try again.';
                            msg.className = 'gcdoc-log-message gcdoc-log-error';
                        }
                    })
                    .catch(function () {
                        button.disabled = false;
                        button.textContent = 'Submit Hours';
                        msg.textContent = 'Network error. Please try again.';
                        msg.className = 'gcdoc-log-message gcdoc-log-error';
                    });
            });
        })();
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('gcdoc_log_hours', 'gcdoc_log_hours_shortcode');

function gcdoc_ajax_log_hours() {
    if (!is_user_logged_in()) {
        wp_send_json_error(['message' => 'Please log in to log volunteer hours.'], 401);
    }

    check_ajax_referer('gcdoc_log_hours', 'nonce');

    $user = wp_get_current_user();
    $email = sanitize_email($user->user_email);
    $date = isset($_POST['date']) ? sanitize_text_field(wp_unslash($_POST['date'])) : '';
    $activity = isset($_POST['activity']) ? sanitize_text_field(wp_unslash($_POST['activity'])) : '';
    $type = isset($_POST['type']) ? sanitize_text_field(wp_unslash($_POST['type'])) : 'STANDARD';
    $clock_hours = isset($_POST['clockHours']) ? floatval($_POST['clockHours']) : 0;

    if (!$activity || $clock_hours <= 0) {
        wp_send_json_error(['message' => 'Please fill in the activity and a valid number of hours.'], 400);
    }

    $result = gcdoc_submit_member_log($email, $date, $activity, $type, $clock_hours);

    if (is_wp_error($result)) {
        wp_send_json_error(['message' => 'Unable to submit your hours right now. Please try again later.'], 502);
    }

    // Hours changed, so the cached report/hours view should refresh on next load.
    delete_transient('gcdoc_hours_' . md5($email));

    wp_send_json_success($result);
}
add_action('wp_ajax_gcdoc_log_hours', 'gcdoc_ajax_log_hours');


function gcdoc_hours_styles() {
    ?>
    <style>
        .gcdoc-hours-report .gcdoc-fy-section { margin-bottom: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.75rem; }
        .gcdoc-hours-report summary { cursor: pointer; padding: 0.25rem 0; }
        .gcdoc-hours-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
        .gcdoc-hours-table th, .gcdoc-hours-table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; }
        .gcdoc-dues-summary { border: 1px solid #d1d5db; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1rem; background: #f9fafb; }
        .gcdoc-dues-summary h3 { margin-top: 0; }
        .gcdoc-dues-amount { font-size: 1.05rem; }
        .gcdoc-dues-ineligible { color: #b45309; }
        .gcdoc-dues-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
        .gcdoc-dues-table th, .gcdoc-dues-table td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid #e5e7eb; }
        .gcdoc-dues-current { background: #dbeafe; font-weight: 600; }
        .gcdoc-dues-pay { margin-top: 0.75rem; margin-bottom: 0; }
        .gcdoc-pay-dues-btn { display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: 700; }
        .gcdoc-pay-dues-btn:hover { background: #15803d; color: #fff; }
        .gcdoc-dues-owed { font-size: 1.05rem; }
        .gcdoc-directory-search { width: 100%; max-width: 320px; padding: 0.4rem 0.6rem; margin-bottom: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; }
        .gcdoc-directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
        .gcdoc-member-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.85rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .gcdoc-member-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.15rem; }
        .gcdoc-member-avatar { border-radius: 50%; flex-shrink: 0; }
        .gcdoc-member-name { font-weight: 600; font-size: 1rem; margin-bottom: 0.15rem; }
        .gcdoc-member-family { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.3rem; }
        .gcdoc-member-type { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 0.5rem; }
        .gcdoc-member-contact { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.9rem; border-top: 1px solid #f3f4f6; padding-top: 0.5rem; }
        .gcdoc-member-contact a { color: #2563eb; text-decoration: none; }
        .gcdoc-member-contact a:hover { text-decoration: underline; }
        .gcdoc-log-hours { max-width: 420px; }
        .gcdoc-log-hours .gcdoc-form-row { margin-bottom: 0.85rem; }
        .gcdoc-log-hours label { display: block; font-weight: 600; margin-bottom: 0.25rem; font-size: 0.9rem; }
        .gcdoc-log-hours input, .gcdoc-log-hours select { width: 100%; padding: 0.5rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.95rem; box-sizing: border-box; }
        .gcdoc-log-submit { background: #4f46e5; color: #fff; border: none; padding: 0.6rem 1.1rem; border-radius: 4px; font-weight: 700; cursor: pointer; }
        .gcdoc-log-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .gcdoc-log-message { margin-top: 0.6rem; font-size: 0.9rem; min-height: 1.2em; }
        .gcdoc-log-success { color: #15803d; }
        .gcdoc-log-error { color: #b91c1c; }
    </style>
    <?php
}
add_action('wp_footer', 'gcdoc_hours_styles');


