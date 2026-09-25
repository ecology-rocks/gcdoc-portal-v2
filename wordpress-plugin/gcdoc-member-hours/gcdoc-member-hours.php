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
// define('GCDOC_REPORT_SECRET', 'a-long-random-shared-secret');

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


function gcdoc_member_hours_shortcode() {
    if (!is_user_logged_in()) {
        return '<p>Please log in to view your volunteer hours.</p>';
    }

    $user = wp_get_current_user();
    $email = sanitize_email($user->user_email);

    // Cache per-user for a few minutes to avoid hammering the endpoint on every page load.
    $cache_key = 'gcdoc_hours_' . md5($email);
    $report = get_transient($cache_key);

    if ($report === false) {
        $report = gcdoc_fetch_member_report($email);
        if (is_wp_error($report)) {
            return '<p>Unable to load your hours right now. Please try again later.</p>';
        }
        set_transient($cache_key, $report, 5 * MINUTE_IN_SECONDS);
    }

    ob_start();
    ?>
    <div class="gcdoc-hours-report">
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
                    <div class="gcdoc-member-card">
                        <div class="gcdoc-member-name"><?php echo esc_html($m['lastName'] . ', ' . $m['firstName']); ?></div>
                        <?php if (!empty($m['familyName'])) : ?>
                            <div class="gcdoc-member-family"><?php echo esc_html($m['familyName']); ?></div>
                        <?php endif; ?>
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


function gcdoc_hours_styles() {
    ?>
    <style>
        .gcdoc-hours-report .gcdoc-fy-section { margin-bottom: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.75rem; }
        .gcdoc-hours-report summary { cursor: pointer; padding: 0.25rem 0; }
        .gcdoc-hours-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
        .gcdoc-hours-table th, .gcdoc-hours-table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; }
        .gcdoc-directory-search { width: 100%; max-width: 320px; padding: 0.4rem 0.6rem; margin-bottom: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; }
        .gcdoc-directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
        .gcdoc-member-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.85rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .gcdoc-member-name { font-weight: 600; font-size: 1rem; margin-bottom: 0.15rem; }
        .gcdoc-member-family { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.3rem; }
        .gcdoc-member-type { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 0.5rem; }
        .gcdoc-member-contact { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.9rem; border-top: 1px solid #f3f4f6; padding-top: 0.5rem; }
        .gcdoc-member-contact a { color: #2563eb; text-decoration: none; }
        .gcdoc-member-contact a:hover { text-decoration: underline; }
    </style>
    <?php
}
add_action('wp_footer', 'gcdoc_hours_styles');


