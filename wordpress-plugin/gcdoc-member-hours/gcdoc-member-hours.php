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
// define('GCDOC_REPORT_SECRET', 'a-long-random-shared-secret');

function gcdoc_fetch_member_report($email) {
    if (!defined('GCDOC_REPORT_ENDPOINT') || !defined('GCDOC_REPORT_SECRET')) {
        return new WP_Error('gcdoc_config', 'GCDOC_REPORT_ENDPOINT / GCDOC_REPORT_SECRET are not configured in wp-config.php.');
    }

    $response = wp_remote_post(GCDOC_REPORT_ENDPOINT, [
        'timeout' => 15,
        'headers' => [
            'Content-Type' => 'application/json',
            'X-Report-Secret' => GCDOC_REPORT_SECRET,
        ],
        'body' => wp_json_encode(['email' => $email]),
    ]);

    if (is_wp_error($response)) {
        return $response;
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code !== 200) {
        return new WP_Error('gcdoc_report_error', 'Report request failed (' . $code . ').');
    }

    $data = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($data)) {
        return new WP_Error('gcdoc_report_parse', 'Unexpected response from report service.');
    }

    return $data;
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

function gcdoc_hours_styles() {
    ?>
    <style>
        .gcdoc-hours-report .gcdoc-fy-section { margin-bottom: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.75rem; }
        .gcdoc-hours-report summary { cursor: pointer; padding: 0.25rem 0; }
        .gcdoc-hours-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
        .gcdoc-hours-table th, .gcdoc-hours-table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; }
    </style>
    <?php
}
add_action('wp_footer', 'gcdoc_hours_styles');


