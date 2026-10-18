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
// define('GCDOC_VOUCHER_ENDPOINT', 'https://your-netlify-site.netlify.app/.netlify/functions/voucher-redeem');
// Optional - default to the same Netlify site as GCDOC_VOUCHER_ENDPOINT, so only set these if they live elsewhere:
// define('GCDOC_VOUCHER_ISSUE_ENDPOINT', 'https://your-netlify-site.netlify.app/.netlify/functions/voucher-issue');
// define('GCDOC_MEMBER_VOUCHERS_ENDPOINT', 'https://your-netlify-site.netlify.app/.netlify/functions/member-vouchers');
// Optional admin PIN: lets people who aren't site Administrators do club-admin things on the website
// (mark vouchers used, issue trial/instructor/one-off vouchers) after entering it once per device.
// GCDOC_VOUCHER_PIN (the older name) still works if GCDOC_ADMIN_PIN isn't set. Use 6+ digits - it can issue vouchers.
// define('GCDOC_ADMIN_PIN', '482613');

define('GCDOC_DUES_PAGE_URL', 'https://gcdoc.com/2026-dues');
define('GCDOC_DUES_PRODUCT_URL', 'https://gcdoc.com/product/membership-dues/');
define('GCDOC_DUES_PRODUCT_SLUG', 'membership-dues');
// sanitize_title() of the dues product's variation attribute name.
define('GCDOC_DUES_ATTRIBUTE', 'how-much-do-you-owe-plus-paypal-fees');
define('GCDOC_HOURS_ENTRY_URL', 'https://gcdoc.com/member-hours-entry/');
define('GCDOC_LOGIN_URL', 'https://gcdoc.com/membership-login');

function gcdoc_login_prompt($message) {
    // Send the user back to whatever page they were actually trying to reach (e.g. the dues page)
    // after they log in, rather than always dropping them on a fixed page. WPUM (and core WP login)
    // both honor the redirect_to parameter.
    $current_url = esc_url_raw(home_url(add_query_arg([], $_SERVER['REQUEST_URI'] ?? '')));
    $login_url = add_query_arg('redirect_to', rawurlencode($current_url), GCDOC_LOGIN_URL);

    return '<p class="gcdoc-login-prompt">' . esc_html($message) . ' <a href="' . esc_url($login_url) . '">Log in here</a>.</p>';
}

function gcdoc_call_report_endpoint($endpoint, $body, $timeout = 15) {
    if (!defined('GCDOC_REPORT_SECRET')) {
        return new WP_Error('gcdoc_config', 'GCDOC_REPORT_SECRET is not configured in wp-config.php.');
    }

    $response = wp_remote_post($endpoint, [
        'timeout' => $timeout,
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

    if (in_array($type, ['regular', 'family', 'household'], true)) {
        if ($hours < 20) {
            return [
                'amount' => null,
                'eligible' => false,
                'note' => 'You have not logged enough hours for Regular/Family membership dues. Please select the $20 Associate Membership option instead, or contact the membership chair at <a href="mailto:membership@gcdoc.com">membership@gcdoc.com</a> with questions.',
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

// Applies the "voted in after July 1" exemption on top of the hours-based schedule.
function gcdoc_member_dues_from_report($report) {
    $dues = gcdoc_calculate_dues($report['membershipType'] ?? '', $report['duesFiscalYearHours'] ?? 0);
    if ($dues !== null && !empty($report['duesExemptVotedIn'])) {
        $dues = ['amount' => 0, 'eligible' => true, 'note' => ''];
    }
    return $dues;
}

// The WooCommerce variation option label for a dues result. The option labels must match the
// WooCommerce variation values exactly. Ineligible members (< 20 hrs) are pointed at Associate.
function gcdoc_dues_option_label($dues) {
    if ($dues === null) {
        return null;
    }

    $labels = [
        50 => '$50',
        40 => '$40',
        30 => '$30',
        15 => '$15',
        20 => 'Associate ($20)',
        0 => '$0 (Lifetime/Applicant)',
    ];
    $amount = $dues['eligible'] ? $dues['amount'] : 20;
    return $labels[$amount] ?? null;
}

// Deep link to the dues product with the matching variation preselected.
function gcdoc_dues_pay_url($dues) {
    if ($dues === null) {
        return GCDOC_DUES_PAGE_URL;
    }

    $label = gcdoc_dues_option_label($dues);
    if ($label === null) {
        return GCDOC_DUES_PRODUCT_URL;
    }

    return GCDOC_DUES_PRODUCT_URL . '?attribute_' . GCDOC_DUES_ATTRIBUTE . '=' . urlencode($label);
}

// Preselect the logged-in member's dues option in the dues product's dropdown, wherever the product
// form is rendered (the product page or the static dues page). Runs server-side as WooCommerce builds
// the <select>, so the page loads with the right price already showing - no refresh, no JS.
function gcdoc_preselect_dues_option($args) {
    if (sanitize_title($args['attribute'] ?? '') !== GCDOC_DUES_ATTRIBUTE || !is_user_logged_in()) {
        return $args;
    }
    // An explicit choice in the URL (e.g. the "Pay Your Dues" deep link) wins.
    if (isset($_REQUEST['attribute_' . GCDOC_DUES_ATTRIBUTE])) {
        return $args;
    }

    $report = gcdoc_get_member_report_cached();
    if (is_wp_error($report) || !empty($report['dues2026Paid'])) {
        return $args;
    }

    $label = gcdoc_dues_option_label(gcdoc_member_dues_from_report($report));
    // Only preselect if the label actually exists on the product, so a renamed variation fails safe.
    if ($label !== null && in_array($label, (array) ($args['options'] ?? []), true)) {
        $args['selected'] = $label;
    }
    return $args;
}
add_filter('woocommerce_dropdown_variation_attribute_options_args', 'gcdoc_preselect_dues_option');

// Adding the dues product to the cart goes straight to checkout instead of the cart page.
function gcdoc_dues_skip_cart($url, $product = null) {
    if ($product instanceof WC_Product && $product->get_slug() === GCDOC_DUES_PRODUCT_SLUG) {
        return wc_get_checkout_url();
    }
    return $url;
}
add_filter('woocommerce_add_to_cart_redirect', 'gcdoc_dues_skip_cart', 10, 2);

// Shared by any shortcode that needs the current user's report (hours, dues owed, etc.)
function gcdoc_get_member_report_cached() {
    if (!is_user_logged_in()) {
        return new WP_Error('gcdoc_not_logged_in', 'Please log in to view this content.');
    }

    $user = wp_get_current_user();
    $email = sanitize_email($user->user_email);

    $cache_key = 'gcdoc_hours_' . md5($email);
    // Append ?gcdoc_refresh=1 (as an admin) to bypass this transient and pull straight from Netlify -
    // useful for confirming whether stale data is this 5-minute cache or a page/CDN cache in front of it.
    $force_refresh = current_user_can('manage_options') && isset($_GET['gcdoc_refresh']);
    $report = $force_refresh ? false : get_transient($cache_key);

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
            <tr><th>Hours Logged (Regular/Family)</th><th>Dues</th></tr>
        </thead>
        <tbody>
            <?php foreach ($rows as $row) : ?>
                <?php $is_current = strtolower(trim($membership_type)) === 'regular' || in_array(strtolower(trim($membership_type)), ['family', 'household'], true); ?>
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
            return gcdoc_login_prompt('Please log in to view your volunteer hours');
        }
        return '<p>Unable to load your hours right now. Please try again later.</p>';
    }

    ob_start();
    $membership_type = $report['membershipType'] ?? '';
    $current_fy_hours = $report['duesFiscalYearHours'] ?? 0;
    $dues = gcdoc_calculate_dues($membership_type, $current_fy_hours);
    // 'earns' | 'pending' (applicants) | 'none' (associates, inactive) - from the member-report function.
    // Older function versions don't send it, so default to showing vouchers as before.
    $voucher_status = $report['voucherStatus'] ?? 'earns';

    // Voted in after July 1 -> no dues owed for the cycle that starts the following Oct 1,
    // regardless of hours. Only kicks in when a VotedInDate is on file, and only for membership
    // types that have a dues schedule to begin with (Inactive/Nonmember/unknown stay hidden).
    $voted_in_exempt = $dues !== null && !empty($report['duesExemptVotedIn']);
    if ($voted_in_exempt) {
        $dues = ['amount' => 0, 'eligible' => true, 'note' => ''];
    }

    // Applicant/Lifetime dues are $0, but they still need to "buy" the product to sign the waiver,
    // so paid/unpaid status is driven entirely by the Dues2026Paid flag, same as every other type.
    if (!empty($report['dues2026Paid'])) {
        $dues_state_class = 'gcdoc-dues-owed-paid';
    } elseif ($dues && !$dues['eligible']) {
        $dues_state_class = 'gcdoc-dues-owed-ineligible';
    } else {
        $dues_state_class = 'gcdoc-dues-owed-unpaid';
    }
    ?>
    <div class="gcdoc-hours-report">
        <?php if ($dues !== null) : ?>
            <div class="gcdoc-dues-summary gcdoc-dues-owed <?php echo esc_attr($dues_state_class); ?>">
                <h3>Dues (<?php echo esc_html($report['duesFiscalYear'] ?? 'Current Year'); ?>)</h3>
                <?php if (!empty($report['dues2026Paid'])) : ?>
                    <p class="gcdoc-dues-amount">✓ Your 2026 dues are paid. Thank you!</p>
                <?php elseif ($voted_in_exempt) : ?>
                    <p class="gcdoc-dues-amount">
                        You were voted in on <?php echo esc_html($report['votedInDate']); ?> (after July 1), so no dues are owed for this cycle.
                    </p>
                <?php elseif ($dues['eligible']) : ?>
                    <p class="gcdoc-dues-amount">
                        Based on <?php echo esc_html($current_fy_hours); ?> hrs logged this fiscal year, your dues are
                        <strong>$<?php echo esc_html($dues['amount']); ?></strong>.
                    </p>
                <?php else : ?>
                    <p class="gcdoc-dues-amount">
                        Based on <?php echo esc_html($current_fy_hours); ?> hrs logged this fiscal year:
                        <?php echo wp_kses_post($dues['note']); ?>
                    </p>
                <?php endif; ?>
                <?php echo gcdoc_render_dues_table($membership_type, $current_fy_hours); ?>
                <?php if (empty($report['dues2026Paid'])) : ?>
                    <p class="gcdoc-dues-pay">
                        <a href="<?php echo esc_url(gcdoc_dues_pay_url($dues)); ?>" class="gcdoc-pay-dues-btn">Pay Your Dues</a>
                        <a href="<?php echo esc_url(GCDOC_HOURS_ENTRY_URL); ?>" class="gcdoc-enter-hours-btn">Enter Missing Hours</a>
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
                        &mdash; <?php echo esc_html($fy['hours']); ?> hrs<?php if ($voucher_status !== 'none') : ?>,
                        <?php echo esc_html($fy['vouchers']); ?> voucher<?php echo intval($fy['vouchers']) === 1 ? '' : 's'; ?><?php if ($voucher_status === 'pending') : ?> (pending vote-in)<?php endif; ?>
                        <?php endif; ?>
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

// Dues box for the dues page: amount owed plus numbered steps for paying it.
function gcdoc_dues_owed_shortcode() {
    $report = gcdoc_get_member_report_cached();
    if (is_wp_error($report)) {
        if ($report->get_error_code() === 'gcdoc_not_logged_in') {
            return gcdoc_login_prompt('Please log in to see and pay your dues');
        }
        return '<p class="gcdoc-dues-owed gcdoc-dues-owed-unpaid">Unable to load your dues amount right now. Please try again later.</p>';
    }

    $dues = gcdoc_member_dues_from_report($report);

    if ($dues === null) {
        return '';
    }

    if (!empty($report['dues2026Paid'])) {
        return '<p class="gcdoc-dues-owed gcdoc-dues-owed-paid">✓ Your 2026 dues are paid. Thank you!</p>';
    }

    if (!empty($report['duesExemptVotedIn'])) {
        $intro = 'You were voted in on ' . esc_html($report['votedInDate']) . ' (after July 1), so no dues are owed for this cycle.';
    } elseif (!$dues['eligible']) {
        $intro = wp_kses_post($dues['note']);
    } else {
        $intro = 'Your dues are $' . esc_html($dues['amount']) . '.';
    }

    // gcdoc_preselect_dues_option() picks this same option in the product form below.
    $label = gcdoc_dues_option_label($dues);
    $state_class = $dues['eligible'] ? 'gcdoc-dues-owed-unpaid' : 'gcdoc-dues-owed-ineligible';

    return '<div class="gcdoc-dues-owed ' . $state_class . '">'
        . '<p>' . $intro . '</p>'
        . '<ol class="gcdoc-dues-steps">'
        . '<li>We already picked <strong>' . esc_html($label) . '</strong> for you in the form below.</li>'
        . '<li>Type your legal name in the <strong>Your Name</strong> box to sign the waiver.</li>'
        . '<li>Click <strong>Add to cart</strong>. </li>'
        . '<li>Use the "Proceed to PayPal" button on the next page to begin the checkout process.</li>'
        . '</ol>'
        . '</div>';
}
add_shortcode('gcdoc_dues_owed', 'gcdoc_dues_owed_shortcode');

function gcdoc_member_directory_shortcode() {
    if (!is_user_logged_in()) {
        return gcdoc_login_prompt('Please log in to view the member directory');
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
                            <?php if (!empty($m['address'])) : ?>
                                <span class="gcdoc-member-address"><?php echo esc_html($m['address']); ?>, <?php echo esc_html($m['city']); ?>, <?php echo esc_html($m['state']); ?> <?php echo esc_html($m['zip']); ?></span>
                            <?php endif; ?>
                            <br />

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
        return gcdoc_login_prompt('Please log in to log volunteer hours');
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


// --- Voucher cards: [gcdoc_voucher], [gcdoc_my_vouchers], [gcdoc_voucher_issue] ---
// [gcdoc_voucher] is the page every voucher card's QR code opens (https://gcdoc.com/voucher/?code=XXXXXX).
// Anyone can check whether a code is valid, and a logged-in member also sees their own unused vouchers
// and can reprint them. Club admins - site Administrators, or anyone who has entered the admin PIN on
// this device - can mark vouchers used, and issue trial / instructor / one-off vouchers on the
// [gcdoc_voucher_issue] page. Vouchers live in the portal's database (netlify voucher-redeem.js,
// voucher-issue.js, member-vouchers.js).

// Cookie name kept from when the PIN was voucher-only, so devices already unlocked stay unlocked.
define('GCDOC_ADMIN_PIN_COOKIE', 'gcdoc_voucher_pin');
define('GCDOC_ADMIN_PIN_MAX_FAILS', 5); // per IP, per 15 minutes

function gcdoc_admin_pin() {
    if (defined('GCDOC_ADMIN_PIN') && GCDOC_ADMIN_PIN !== '') {
        return (string) GCDOC_ADMIN_PIN;
    }
    if (defined('GCDOC_VOUCHER_PIN') && GCDOC_VOUCHER_PIN !== '') {
        return (string) GCDOC_VOUCHER_PIN;
    }
    return '';
}

function gcdoc_admin_pin_enabled() {
    return gcdoc_admin_pin() !== '';
}

// Stored in the cookie instead of the PIN itself; changing the PIN invalidates every saved device.
function gcdoc_admin_pin_token() {
    return hash_hmac('sha256', gcdoc_admin_pin(), wp_salt('auth'));
}

// Who is acting as a club admin on this request (recorded on vouchers they redeem or issue), or null
// if this visitor isn't one.
function gcdoc_admin_actor() {
    if (is_user_logged_in() && current_user_can('manage_options')) {
        return wp_get_current_user()->display_name;
    }
    if (gcdoc_admin_pin_enabled() && isset($_COOKIE[GCDOC_ADMIN_PIN_COOKIE])
        && hash_equals(gcdoc_admin_pin_token(), (string) $_COOKIE[GCDOC_ADMIN_PIN_COOKIE])) {
        // A PIN device that's also logged in to WordPress puts the person's name on the record
        return is_user_logged_in() ? wp_get_current_user()->display_name . ' (PIN)' : 'PIN (website)';
    }
    return null;
}

// "Enter the admin PIN" form. Posts to gcdoc_voucher_handle_post(), which sets the device cookie.
function gcdoc_admin_pin_form($label, $code = '') {
    ob_start();
    ?>
    <form method="post" class="gcdoc-voucher-pin">
        <?php wp_nonce_field('gcdoc_voucher', '_gcdoc_voucher_nonce'); ?>
        <input type="hidden" name="gcdoc_voucher_action" value="pin">
        <input type="hidden" name="code" value="<?php echo esc_attr($code); ?>">
        <label><?php echo esc_html($label); ?>
            <input type="password" name="pin" inputmode="numeric" autocomplete="off" required>
        </label>
        <button type="submit" class="gcdoc-voucher-btn-secondary">Enter PIN</button>
    </form>
    <?php
    return ob_get_clean();
}

// Result banners shared by the voucher pages (?result=...)
function gcdoc_voucher_result_html($result) {
    $messages = [
        'redeemed' => ['ok', '✓ Voucher marked as used.'],
        'already_used' => ['bad', 'This voucher was already used - it was not marked again.'],
        'pin_ok' => ['ok', 'PIN accepted. This device can now mark vouchers used and issue vouchers.'],
        'pin_bad' => ['bad', 'That PIN is not correct.'],
        'pin_locked' => ['bad', 'Too many wrong PIN attempts. Please wait 15 minutes and try again.'],
        'not_allowed' => ['bad', 'Only site administrators or someone with the admin PIN can mark vouchers used.'],
        'error' => ['bad', 'Something went wrong. Please try again.'],
    ];
    if (!isset($messages[$result])) {
        return '';
    }
    return '<p class="gcdoc-voucher-msg gcdoc-voucher-msg-' . esc_attr($messages[$result][0]) . '">'
        . esc_html($messages[$result][1]) . '</p>';
}

function gcdoc_voucher_normalize_code($value) {
    return substr(preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $value)), 0, 12);
}

function gcdoc_voucher_call($code, $action, $redeemed_by = '') {
    if (!defined('GCDOC_VOUCHER_ENDPOINT')) {
        return new WP_Error('gcdoc_config', 'GCDOC_VOUCHER_ENDPOINT is not configured in wp-config.php.');
    }
    return gcdoc_call_report_endpoint(GCDOC_VOUCHER_ENDPOINT, [
        'code' => $code,
        'action' => $action,
        'redeemedBy' => $redeemed_by,
    ]);
}

// The other voucher functions sit next to voucher-redeem on the same Netlify site unless configured.
function gcdoc_voucher_endpoint($constant, $function_name) {
    if (defined($constant)) {
        return constant($constant);
    }
    if (defined('GCDOC_VOUCHER_ENDPOINT')) {
        return preg_replace('#[^/]+/?$#', $function_name, GCDOC_VOUCHER_ENDPOINT);
    }
    return null;
}

function gcdoc_voucher_issue_call($body) {
    $endpoint = gcdoc_voucher_endpoint('GCDOC_VOUCHER_ISSUE_ENDPOINT', 'voucher-issue');
    if (!$endpoint) {
        return new WP_Error('gcdoc_config', 'GCDOC_VOUCHER_ENDPOINT is not configured in wp-config.php.');
    }
    // Generous timeout: a big trial set or session writes a few hundred docs and QR codes
    return gcdoc_call_report_endpoint($endpoint, $body, 45);
}

function gcdoc_fetch_member_vouchers($email) {
    $endpoint = gcdoc_voucher_endpoint('GCDOC_MEMBER_VOUCHERS_ENDPOINT', 'member-vouchers');
    if (!$endpoint) {
        return new WP_Error('gcdoc_config', 'GCDOC_VOUCHER_ENDPOINT is not configured in wp-config.php.');
    }
    return gcdoc_call_report_endpoint($endpoint, ['email' => $email], 30);
}

// Form posts are handled before the page renders so the PIN cookie can be set, and so a refresh
// after "Mark Used" can't resubmit (Post/Redirect/Get).
function gcdoc_voucher_handle_post() {
    if (empty($_POST['gcdoc_voucher_action'])) {
        return;
    }
    if (!isset($_POST['_gcdoc_voucher_nonce']) || !wp_verify_nonce($_POST['_gcdoc_voucher_nonce'], 'gcdoc_voucher')) {
        return;
    }

    $code = gcdoc_voucher_normalize_code($_POST['code'] ?? '');
    $back = remove_query_arg(['result', 'code'], wp_get_referer() ?: home_url(add_query_arg([], $_SERVER['REQUEST_URI'] ?? '')));
    if ($code !== '') {
        $back = add_query_arg('code', $code, $back);
    }
    $action = sanitize_key($_POST['gcdoc_voucher_action']);

    if ($action === 'pin' && gcdoc_admin_pin_enabled()) {
        $ip_key = 'gcdoc_vpin_fail_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
        $fails = (int) get_transient($ip_key);
        if ($fails >= GCDOC_ADMIN_PIN_MAX_FAILS) {
            wp_safe_redirect(add_query_arg('result', 'pin_locked', $back));
            exit;
        }
        if (hash_equals(gcdoc_admin_pin(), trim((string) ($_POST['pin'] ?? '')))) {
            delete_transient($ip_key);
            setcookie(GCDOC_ADMIN_PIN_COOKIE, gcdoc_admin_pin_token(), [
                'expires' => time() + 180 * DAY_IN_SECONDS,
                'path' => COOKIEPATH ?: '/',
                'secure' => is_ssl(),
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            wp_safe_redirect(add_query_arg('result', 'pin_ok', $back));
        } else {
            set_transient($ip_key, $fails + 1, 15 * MINUTE_IN_SECONDS);
            wp_safe_redirect(add_query_arg('result', 'pin_bad', $back));
        }
        exit;
    }

    if ($action === 'redeem') {
        $redeemer = gcdoc_admin_actor();
        if ($redeemer === null) {
            wp_safe_redirect(add_query_arg('result', 'not_allowed', $back));
            exit;
        }
        $result = gcdoc_voucher_call($code, 'redeem', $redeemer);
        if (is_wp_error($result) || empty($result['found'])) {
            $flag = 'error';
        } else {
            $flag = !empty($result['justRedeemed']) ? 'redeemed' : 'already_used';
        }
        wp_safe_redirect(add_query_arg('result', $flag, $back));
        exit;
    }
}
add_action('template_redirect', 'gcdoc_voucher_handle_post');

// --- Printable voucher cards ---
// Same 3.5in x 2in card as the portal's VoucherPrint.vue. Cards show on screen at real size; "Print"
// (gcdocPrintVoucherCards) lays the chosen ones out on letter pages, two cut-apart columns of 5.

// The card's QR code as inline SVG. An <img> printed blank on the live site (lazy-load scripts / theme
// print styles act on images), and inline SVG sidesteps all of that. Decodes the data URI the Netlify
// functions send and keeps only the svg/path markup the qrcode library produces.
function gcdoc_voucher_qr_svg($data_uri) {
    $prefix = 'data:image/svg+xml;base64,';
    if (strpos((string) $data_uri, $prefix) !== 0) {
        return '';
    }
    $svg = base64_decode(substr($data_uri, strlen($prefix)), true);
    if ($svg === false) {
        return '';
    }
    return wp_kses($svg, [
        'svg' => ['xmlns' => true, 'viewbox' => true, 'shape-rendering' => true],
        'path' => ['fill' => true, 'stroke' => true, 'd' => true],
    ]);
}

function gcdoc_voucher_card_html($card) {
    $is_class = ($card['type'] ?? '') === 'class';
    $reason = (string) ($card['reason'] ?? '');
    $name = (string) ($card['memberName'] ?? '');
    // Print stacks: one per person; write-in cards stack by what they were issued for (e.g. one trial role)
    $group = ($card['memberEmail'] ?? '') ?: ($name !== '' ? $name : 'write-in|' . $reason);
    $meta = (($card['source'] ?? '') === 'manual' ? 'Issued ' : 'Earned ') . ($card['fyLabel'] ?? '') . ($reason !== '' ? ' · ' . $reason : '');
    $qr = gcdoc_voucher_qr_svg($card['qr'] ?? '');

    ob_start();
    ?>
    <div class="gcdoc-vcard <?php echo $is_class ? 'is-class' : 'is-blue'; ?>" data-group="<?php echo esc_attr($group); ?>" data-code="<?php echo esc_attr($card['code'] ?? ''); ?>">
        <div class="gcdoc-vcard-text">
            <div class="gcdoc-vcard-org">GCDOC · <?php echo $is_class ? 'Service Voucher' : 'Blue Ribbon Voucher'; ?></div>
            <div class="gcdoc-vcard-value"><?php echo $is_class ? 'Good for one class' : '$20 off one trial entry'; ?></div>
            <?php if ($name !== '') : ?>
                <div class="gcdoc-vcard-name"><?php echo esc_html($name); ?></div>
            <?php else : ?>
                <div class="gcdoc-vcard-name gcdoc-vcard-write-in">Name:</div>
            <?php endif; ?>
            <div class="gcdoc-vcard-household">or household</div>
            <div class="gcdoc-vcard-meta"><?php echo esc_html($meta); ?></div>
            <?php if (!$is_class) : ?><div class="gcdoc-vcard-fine gcdoc-vcard-alt">Can also be used for one free class</div><?php endif; ?>
            <div class="gcdoc-vcard-fine">Not transferable outside the household · No monetary value</div>
        </div>
        <div class="gcdoc-vcard-qr">
            <?php echo $qr; // sanitized in gcdoc_voucher_qr_svg() ?>
            <div class="gcdoc-vcard-code"><?php echo esc_html($card['code'] ?? ''); ?></div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// $selectable: a "Print this one" checkbox per card, so a member can reprint just the one they lost
function gcdoc_voucher_cards_html($cards, $selectable) {
    $html = '<div class="gcdoc-vcards">';
    foreach ($cards as $card) {
        $html .= '<div class="gcdoc-vcard-item">';
        if ($selectable) {
            $html .= '<label class="gcdoc-vcard-select"><input type="checkbox" checked> Print this one</label>';
        }
        $html .= gcdoc_voucher_card_html($card) . '</div>';
    }
    return $html . '</div>' . gcdoc_voucher_print_script();
}

// Output once per page
function gcdoc_voucher_print_script() {
    static $done = false;
    if ($done) {
        return '';
    }
    $done = true;
    ob_start();
    ?>
    <script>
        // Lay out the chosen cards (checked, or all if there are no checkboxes) inside `scope` on letter
        // pages and print just those. Port of VoucherPrint.vue: two columns of 5 per page, each column one
        // stack after cutting; someone with 5+ cards gets their own column(s), smaller groups share.
        function gcdocPrintVoucherCards(scope) {
            var PER_COLUMN = 5, OWN_COLUMN_MIN = 5;
            var cards = [];
            scope.querySelectorAll('.gcdoc-vcard-item').forEach(function (item) {
                var box = item.querySelector('.gcdoc-vcard-select input');
                if (!box || box.checked) cards.push(item.querySelector('.gcdoc-vcard'));
            });
            if (!cards.length) { alert('Pick at least one voucher to print.'); return; }

            var groups = [], byKey = {};
            cards.forEach(function (card) {
                var key = card.getAttribute('data-group');
                if (!byKey[key]) { byKey[key] = []; groups.push(byKey[key]); }
                byKey[key].push(card);
            });

            var columns = [], column = [];
            var closeColumn = function () { if (column.length) { columns.push(column); column = []; } };
            groups.forEach(function (g) {
                if (g.length >= OWN_COLUMN_MIN) {
                    closeColumn();
                    for (var i = 0; i < g.length; i += PER_COLUMN) { column = g.slice(i, i + PER_COLUMN); closeColumn(); }
                } else {
                    if (column.length + g.length > PER_COLUMN) closeColumn();
                    column = column.concat(g);
                }
            });
            closeColumn();

            var root = document.createElement('div');
            root.id = 'gcdoc-print-root';
            for (var p = 0; p < columns.length; p += 2) {
                var page = document.createElement('div');
                page.className = 'gcdoc-print-page';
                columns.slice(p, p + 2).forEach(function (col) {
                    var colEl = document.createElement('div');
                    colEl.className = 'gcdoc-print-col';
                    col.forEach(function (card) { colEl.appendChild(card.cloneNode(true)); });
                    page.appendChild(colEl);
                });
                root.appendChild(page);
            }
            // Page rule only while printing cards, so it never affects printing other pages of the site
            var pageStyle = document.createElement('style');
            pageStyle.textContent = '@page { size: letter; margin: 0; }';

            document.body.appendChild(root);
            document.head.appendChild(pageStyle);
            document.body.classList.add('gcdoc-printing');
            var cleanup = function () {
                document.body.classList.remove('gcdoc-printing');
                if (root.parentNode) root.parentNode.removeChild(root);
                if (pageStyle.parentNode) pageStyle.parentNode.removeChild(pageStyle);
                window.removeEventListener('afterprint', cleanup);
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
        }
    </script>
    <?php
    return ob_get_clean();
}

// --- A member's own unused vouchers (reprint) ---

function gcdoc_my_vouchers_html() {
    if (!is_user_logged_in()) {
        return gcdoc_login_prompt('Log in to see and reprint your unused vouchers.');
    }

    $data = gcdoc_fetch_member_vouchers(sanitize_email(wp_get_current_user()->user_email));
    if (is_wp_error($data)) {
        return '<p class="gcdoc-voucher-msg gcdoc-voucher-msg-bad">Unable to load your vouchers right now. Please try again later.</p>';
    }
    $cards = $data['cards'] ?? [];

    ob_start();
    ?>
    <div class="gcdoc-my-vouchers">
        <h3>Your unused vouchers</h3>
        <?php if (empty($cards)) : ?>
            <p>You don't have any unused voucher cards right now.</p>
        <?php else : ?>
            <p>
                You have <strong><?php echo count($cards); ?></strong> unused voucher<?php echo count($cards) === 1 ? '' : 's'; ?>.
                Lost or forgot a card? Print it again here. Each code can only be used once, so a reprint
                replaces your card - it doesn't add a voucher.
            </p>
            <p class="gcdoc-vcard-actions">
                <button type="button" class="gcdoc-voucher-btn-secondary" onclick="gcdocPrintVoucherCards(this.closest('.gcdoc-my-vouchers'))">🖨️ Print selected</button>
                <span class="gcdoc-vcard-tip">Prints business-card size; cut along the dashed lines. Print at 100% / Actual size.</span>
            </p>
            <?php echo gcdoc_voucher_cards_html($cards, true); ?>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('gcdoc_my_vouchers', 'gcdoc_my_vouchers_html');

function gcdoc_voucher_shortcode() {
    $code = gcdoc_voucher_normalize_code($_GET['code'] ?? '');
    $result = sanitize_key($_GET['result'] ?? '');
    $page_url = remove_query_arg(['code', 'result'], home_url(add_query_arg([], $_SERVER['REQUEST_URI'] ?? '')));

    ob_start();
    ?>
    <div class="gcdoc-voucher">
        <?php echo gcdoc_voucher_result_html($result); ?>

        <?php if ($code !== '') : ?>
            <?php $voucher = gcdoc_voucher_call($code, 'lookup'); ?>
            <?php if (is_wp_error($voucher)) : ?>
                <p class="gcdoc-voucher-msg gcdoc-voucher-msg-bad">Unable to look up vouchers right now. Please try again later.</p>
            <?php elseif (empty($voucher['found'])) : ?>
                <p class="gcdoc-voucher-msg gcdoc-voucher-msg-bad">
                    No voucher found with code <strong><?php echo esc_html($code); ?></strong>. Check the code and try again.
                </p>
            <?php else : ?>
                <?php
                $is_class = ($voucher['type'] ?? '') === 'class';
                $is_used = ($voucher['status'] ?? '') === 'used';
                $redeemer = gcdoc_admin_actor();
                ?>
                <div class="gcdoc-voucher-card <?php echo $is_class ? 'is-class' : 'is-blue'; ?>">
                    <div class="gcdoc-voucher-type"><?php echo $is_class ? 'Service Voucher' : 'Blue Ribbon Voucher'; ?></div>
                    <div class="gcdoc-voucher-value"><?php echo $is_class ? 'Good for one class' : '$20 off one trial entry'; ?></div>
                    <?php if (!$is_class) : ?><div class="gcdoc-voucher-alt">Can also be used for one free class</div><?php endif; ?>
                    <?php if (!empty($voucher['memberName'])) : ?>
                        <div class="gcdoc-voucher-name"><?php echo esc_html($voucher['memberName']); ?> <span>or household</span></div>
                    <?php else : ?>
                        <div class="gcdoc-voucher-name">Name written on card <span>or household</span></div>
                    <?php endif; ?>
                    <div class="gcdoc-voucher-meta">
                        <?php echo esc_html($voucher['fyLabel']); ?>
                        <?php if (!empty($voucher['reason'])) : ?> &middot; <?php echo esc_html($voucher['reason']); ?><?php endif; ?>
                        &middot; Code <?php echo esc_html($voucher['code']); ?>
                    </div>

                    <?php if ($is_used) : ?>
                        <div class="gcdoc-voucher-status gcdoc-voucher-used">
                            ✗ USED
                            <?php if (!empty($voucher['usedAt'])) : ?>
                                on <?php echo esc_html(wp_date(get_option('date_format'), strtotime($voucher['usedAt']))); ?>
                            <?php endif; ?>
                            <?php if (!empty($voucher['usedBy'])) : ?>(<?php echo esc_html($voucher['usedBy']); ?>)<?php endif; ?>
                        </div>
                    <?php else : ?>
                        <div class="gcdoc-voucher-status gcdoc-voucher-valid">✓ VALID - not yet used</div>

                        <?php if ($redeemer !== null) : ?>
                            <form method="post" class="gcdoc-voucher-redeem">
                                <?php wp_nonce_field('gcdoc_voucher', '_gcdoc_voucher_nonce'); ?>
                                <input type="hidden" name="gcdoc_voucher_action" value="redeem">
                                <input type="hidden" name="code" value="<?php echo esc_attr($voucher['code']); ?>">
                                <button type="submit" class="gcdoc-voucher-btn">Mark Used</button>
                            </form>
                        <?php elseif (gcdoc_admin_pin_enabled()) : ?>
                            <?php echo gcdoc_admin_pin_form('Staff: enter the admin PIN to mark vouchers used', $voucher['code']); ?>
                        <?php endif; ?>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>

        <div class="gcdoc-voucher-lookup-box">
            <h3><?php echo $code === '' ? 'Check a voucher code' : 'Check another code'; ?></h3>
            <p>Scan the QR code on a voucher card, or type the code printed under it, to see whether it's still valid.</p>
            <form method="get" action="<?php echo esc_url($page_url); ?>" class="gcdoc-voucher-lookup">
                <label>
                    Voucher code
                    <input type="text" name="code" maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="e.g. K7M2QX">
                </label>
                <button type="submit" class="gcdoc-voucher-btn-secondary">Look up</button>
            </form>
        </div>

        <?php // Not on a scanned card's page - whoever is scanning wants that card, not their own list ?>
        <?php if ($code === '') : ?>
            <?php echo gcdoc_my_vouchers_html(); ?>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('gcdoc_voucher', 'gcdoc_voucher_shortcode');

// --- Issuing vouchers from the website: [gcdoc_voucher_issue] ---
// Club admins (Administrators or the admin PIN) issue the same hand-issued sets as the portal's Vouchers
// page: trial workers, instructors (from the registrar's CSV - vouchers, plus service hours sent to the
// portal's approval queue),
// and one-offs. New vouchers start unpublished (hidden from members). After issuing, the page shows the
// set (?gcdoc_set=..., reopenable) to check, print, publish, or delete while still unpublished.

// Vouchers per trial day, by role - starting points only, editable on the form. Keep in sync with
// TRIAL_PRESETS in src/modules/admin/components/TrialVoucherIssuer.vue.
function gcdoc_trial_presets() {
    $standard = [['Secretary', 2], ['Chair', 1], ['Scheduler', 1], ['Ring Steward/Worker Coordinator', 1], ['Food Chair', 1], ['Chief Course Builder', 1]];
    return [
        'Agility' => $standard,
        'Obedience' => $standard,
        'Conformation' => $standard,
        'Barn Hunt' => [['Pre-Trial Secretary', 1], ['Trial Secretary', 1], ['Chair', 1], ['Food Chair', 1], ['Volunteer Appreciation', 2], ['Blind Steward', 1]],
    ];
}

function gcdoc_fy_label($start_year) {
    return 'FY' . substr((string) ($start_year + 1), -2);
}

function gcdoc_voucher_issue_shortcode() {
    $result = sanitize_key($_GET['result'] ?? '');
    $page_url = remove_query_arg(['gcdoc_set', 'issued', 'hours', 'result'], home_url(add_query_arg([], $_SERVER['REQUEST_URI'] ?? '')));
    $actor = gcdoc_admin_actor();

    ob_start();
    echo '<div class="gcdoc-vissue">' . gcdoc_voucher_result_html($result);

    if ($actor === null) {
        if (gcdoc_admin_pin_enabled()) {
            echo '<p>Issuing vouchers is for club admins. Enter the admin PIN to unlock this device.</p>';
            echo gcdoc_admin_pin_form('Admin PIN');
        } else {
            echo '<p>Only site administrators can issue vouchers.</p>';
        }
        echo '</div>';
        return ob_get_clean();
    }

    $set_id = sanitize_text_field(wp_unslash($_GET['gcdoc_set'] ?? ''));
    if ($set_id !== '') {
        echo gcdoc_voucher_issue_set_html($set_id, $page_url);
        echo '</div>';
        return ob_get_clean();
    }

    $now_year = (int) wp_date('Y');
    $current_fy = (int) wp_date('n') >= 10 ? $now_year : $now_year - 1;
    $fy_options = [$current_fy + 1, $current_fy, $current_fy - 1];

    // Member picker: "First Last (email)" - the email in parentheses links the voucher to the member
    $directory = get_transient('gcdoc_directory_all');
    if ($directory === false) {
        $directory = gcdoc_fetch_member_directory();
        if (!is_wp_error($directory)) {
            set_transient('gcdoc_directory_all', $directory, 5 * MINUTE_IN_SECONDS);
        }
    }
    $members = [];
    foreach ((is_wp_error($directory) ? [] : ($directory['members'] ?? [])) as $m) {
        $email = strtolower(trim($m['email'] ?? ''));
        if ($email === '') {
            continue;
        }
        $label = trim(($m['firstName'] ?? '') . ' ' . ($m['lastName'] ?? ''));
        if (!empty($m['familyName'])) {
            $label .= ' & ' . $m['familyName'];
        }
        $members[] = ['email' => $email, 'label' => $label . ' (' . $email . ')'];
    }

    $fy_select = function ($name, $selected) use ($fy_options) {
        $html = '<select name="' . esc_attr($name) . '">';
        foreach ($fy_options as $y) {
            $html .= '<option value="' . esc_attr($y) . '"' . selected($y, $selected, false) . '>' . esc_html(gcdoc_fy_label($y)) . '</option>';
        }
        return $html . '</select>';
    };
    $type_select = '<select name="voucherType"><option value="blue">Blue Ribbon</option><option value="class">Service</option></select>';
    ?>
    <p class="gcdoc-vissue-who">Issuing as <strong><?php echo esc_html($actor); ?></strong>. New vouchers also show up in the portal under "Issued by hand".</p>
    <?php if (is_wp_error($directory)) : ?>
        <p class="gcdoc-voucher-msg gcdoc-voucher-msg-bad">Couldn't load the member list, so names won't autocomplete. You can still type names in.</p>
    <?php endif; ?>

    <div class="gcdoc-vissue-tabs" role="tablist">
        <button type="button" data-tab="trial" class="is-active">Trial workers</button>
        <button type="button" data-tab="instructor">Instructors (class session)</button>
        <button type="button" data-tab="oneoff">One-off</button>
    </div>

    <datalist id="gcdoc-vi-members">
        <?php foreach ($members as $m) : ?><option value="<?php echo esc_attr($m['label']); ?>"></option><?php endforeach; ?>
    </datalist>

    <!-- Trial workers -->
    <form class="gcdoc-vissue-form" data-kind="trial">
        <div class="gcdoc-vissue-fields">
            <label>Trial type
                <input name="trialType" list="gcdoc-vi-trial-presets" placeholder="e.g. Agility" required>
                <datalist id="gcdoc-vi-trial-presets">
                    <?php foreach (array_keys(gcdoc_trial_presets()) as $name) : ?><option value="<?php echo esc_attr($name); ?>"></option><?php endforeach; ?>
                </datalist>
            </label>
            <label>Trial dates <input name="trialDates" placeholder="e.g. Mar 6-8, 2027" required></label>
            <label class="narrow">Days <input name="days" type="number" min="1" max="10" value="1" required></label>
            <label>Voucher type <?php echo $type_select; ?></label>
            <label class="narrow">Fiscal year <?php echo $fy_select('fiscalYear', $current_fy); ?></label>
        </div>
        <table class="gcdoc-vissue-table">
            <thead><tr><th>Role</th><th>Person</th><th class="num">Per day</th><th class="num">Total</th><th></th></tr></thead>
            <tbody></tbody>
        </table>
        <p class="gcdoc-vissue-empty">Pick a trial type above to load its roles, or add roles.</p>
        <div class="gcdoc-vissue-actions">
            <button type="button" class="gcdoc-voucher-btn-secondary" data-add-row>+ Add role</button>
            <span class="gcdoc-vissue-summary"></span>
            <button type="submit" class="gcdoc-vissue-submit">Issue trial vouchers</button>
        </div>
    </form>

    <!-- Instructors -->
    <form class="gcdoc-vissue-form" data-kind="instructor" hidden>
        <p class="gcdoc-vissue-intro">
            Upload the registrar's list (one row per instructor per class, with Class, Instructor, and Weeks
            Attended columns - the same file the portal takes). Per class: 5+ of 7 weeks earns 1 Blue Ribbon
            voucher, and every week attended adds 1 service hour (sent to the portal admin for approval).
            <button type="button" class="gcdoc-vissue-link" data-template>⬇️ Download blank template</button>
        </p>
        <div class="gcdoc-vissue-fields">
            <label>Session name <input name="sessionName" placeholder="e.g. Session 1 2027" required></label>
            <label>Session end date <input name="sessionDate" type="date" required></label>
            <label class="narrow">Counts toward <?php echo $fy_select('fiscalYear', $current_fy); ?></label>
            <label>Registrar's CSV <input name="csv" type="file" accept=".csv,text/csv"></label>
        </div>
        <p class="gcdoc-vissue-note" data-date-note hidden></p>
        <div data-review></div>
        <div class="gcdoc-vissue-actions">
            <span class="gcdoc-vissue-summary"></span>
            <button type="submit" class="gcdoc-vissue-submit">Issue vouchers and hours</button>
        </div>
    </form>

    <!-- One-off -->
    <form class="gcdoc-vissue-form" data-kind="oneoff" hidden>
        <div class="gcdoc-vissue-fields">
            <label>Reason (printed on the card)
                <input name="reason" list="gcdoc-vi-reason-presets" placeholder="e.g. Board Service" required>
                <datalist id="gcdoc-vi-reason-presets"><option value="Board Service"></option></datalist>
            </label>
            <label>Voucher type <?php echo $type_select; ?></label>
            <label class="narrow">Each <input name="perPerson" type="number" min="1" max="20" value="1"></label>
            <label class="narrow">Fiscal year <?php echo $fy_select('fiscalYear', $current_fy); ?></label>
        </div>
        <table class="gcdoc-vissue-table">
            <thead><tr><th>Person</th><th class="num">Vouchers</th><th></th></tr></thead>
            <tbody></tbody>
        </table>
        <div class="gcdoc-vissue-actions">
            <button type="button" class="gcdoc-voucher-btn-secondary" data-add-row>+ Add person</button>
            <span class="gcdoc-vissue-summary"></span>
            <button type="submit" class="gcdoc-vissue-submit">Issue vouchers</button>
        </div>
    </form>

    <p class="gcdoc-vissue-msg" role="status"></p>
    <?php
    echo gcdoc_voucher_issue_script([
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('gcdoc_voucher_issue'),
        'pageUrl' => $page_url,
        'members' => $members,
        'trialPresets' => gcdoc_trial_presets(),
        // Picking a preset reason sets its voucher type and count (board members: 5 Blue Ribbon, once a year)
        'reasonPresets' => ['Board Service' => ['type' => 'blue', 'perPerson' => 5]],
    ]);
    echo '</div>';
    return ob_get_clean();
}
add_shortcode('gcdoc_voucher_issue', 'gcdoc_voucher_issue_shortcode');

// The cards of one issued set: print, publish (release to members), or delete while still unpublished.
// Stored status 'printed' is what the portal shows as "Published".
function gcdoc_voucher_issue_set_html($set_id, $page_url) {
    $data = gcdoc_voucher_issue_call(['action' => 'set', 'setId' => $set_id]);
    $cards = is_wp_error($data) ? [] : ($data['cards'] ?? []);
    $unpublished = array_values(array_map(function ($c) {
        return $c['code'];
    }, array_filter($cards, function ($c) {
        return ($c['status'] ?? '') === 'created';
    })));
    $deletable = $cards && count($unpublished) === count($cards);

    ob_start();
    if (isset($_GET['issued'])) {
        $issued = absint($_GET['issued']);
        $hours = (float) ($_GET['hours'] ?? 0);
        echo '<p class="gcdoc-voucher-msg gcdoc-voucher-msg-ok">✓ Issued ' . esc_html($issued) . ' voucher' . ($issued === 1 ? '' : 's')
            . ($hours > 0 ? ' and sent ' . esc_html($hours) . ' service hours to the portal for approval' : '') . '.</p>';
    }
    ?>
    <p><a href="<?php echo esc_url($page_url); ?>">&larr; Issue more vouchers</a></p>
    <?php if (is_wp_error($data)) : ?>
        <p class="gcdoc-voucher-msg gcdoc-voucher-msg-bad">Unable to load these vouchers right now. Reload the page to try again.</p>
    <?php elseif (empty($cards)) : ?>
        <p>No vouchers in this set<?php echo isset($_GET['issued']) ? ' - nobody reached the 5 weeks for a voucher' : ''; ?>.</p>
    <?php else : ?>
        <p class="gcdoc-vcard-tip">
            Check these over first. While they're <strong>unpublished</strong>, members can't see them and you can still
            <strong>delete the set</strong> (e.g. a file uploaded twice). When they look right, click <strong>Publish</strong>:
            members then see them in their voucher list on the website, and the set can't be deleted any more.
            To print here: letter-size cardstock at <strong>100% / Actual size</strong>, margins <strong>None</strong>, cut along
            the dashed lines. Bookmark this page to come back to it.
        </p>
        <div class="gcdoc-vissue-set">
            <p class="gcdoc-vcard-actions">
                <strong><?php echo count($cards); ?> cards</strong>
                <button type="button" class="gcdoc-voucher-btn-secondary" onclick="gcdocPrintVoucherCards(this.closest('.gcdoc-vissue-set'))">🖨️ Print</button>
                <?php if ($unpublished) : ?>
                    <button type="button" class="gcdoc-voucher-btn-secondary" data-publish="<?php echo esc_attr(wp_json_encode($unpublished)); ?>">✓ Publish <?php echo count($unpublished); ?> to members</button>
                <?php else : ?>
                    <span>✓ Published - members can see these.</span>
                <?php endif; ?>
                <?php if ($deletable) : ?>
                    <button type="button" class="gcdoc-vissue-delete" data-delete-set="<?php echo esc_attr($set_id); ?>">Delete this set</button>
                <?php endif; ?>
            </p>
            <?php echo gcdoc_voucher_cards_html($cards, false); ?>
        </div>
        <script>
            (function () {
                var post = function (action, payload) {
                    var data = new FormData();
                    data.append('action', action);
                    data.append('nonce', '<?php echo esc_js(wp_create_nonce('gcdoc_voucher_issue')); ?>');
                    data.append('payload', JSON.stringify(payload));
                    return fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', { method: 'POST', credentials: 'same-origin', body: data })
                        .then(function (res) { return res.json().catch(function () { return { success: false }; }); })
                        .then(function (json) {
                            if (!json.success) throw new Error((json.data && json.data.message) || 'Something went wrong. Please try again.');
                            return json.data;
                        });
                };

                var publish = document.querySelector('[data-publish]');
                if (publish) publish.addEventListener('click', function () {
                    if (!confirm('Publish these vouchers? Members will see them on the website, and this set can\'t be deleted after this.')) return;
                    publish.disabled = true;
                    post('gcdoc_voucher_mark_printed', { codes: JSON.parse(publish.getAttribute('data-publish')) })
                        .then(function () { location.reload(); })
                        .catch(function (e) { publish.disabled = false; alert('Could not publish: ' + e.message); });
                });

                var del = document.querySelector('[data-delete-set]');
                if (del) del.addEventListener('click', function () {
                    if (!confirm('Delete all <?php echo count($cards); ?> vouchers in this set? This can\'t be undone. (Any service hours from this upload stay in the portal\'s approval queue for the admin to review.)')) return;
                    del.disabled = true;
                    post('gcdoc_voucher_delete_set', { setId: del.getAttribute('data-delete-set') })
                        .then(function (res) {
                            alert('Deleted ' + res.deleted + ' vouchers.');
                            location.href = '<?php echo esc_js($page_url); ?>';
                        })
                        .catch(function (e) { del.disabled = false; alert('Could not delete: ' + e.message); });
                });
            })();
        </script>
    <?php endif; ?>
    <?php
    return ob_get_clean();
}

function gcdoc_voucher_issue_script($config) {
    ob_start();
    ?>
    <script>
    (function () {
        var cfg = <?php echo wp_json_encode($config); ?>;
        var root = document.currentScript.closest('.gcdoc-vissue');
        var msg = root.querySelector('.gcdoc-vissue-msg');
        var memberLabels = {};
        cfg.members.forEach(function (m) { memberLabels[m.label] = m.email; });

        var esc = function (s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        };
        var num = function (v) { var n = Math.trunc(Number(v)); return n > 0 ? n : 0; };
        var showMsg = function (text, ok) {
            msg.textContent = text;
            msg.className = 'gcdoc-vissue-msg ' + (ok ? 'gcdoc-log-success' : 'gcdoc-log-error');
        };

        // "Jane Smith (jane@x.com)" -> linked to that member; anything else prints as a typed name;
        // blank prints a write-in line
        var personOf = function (value) {
            var v = String(value || '').trim();
            var m = /\(([^()\s]+@[^()\s]+)\)\s*$/.exec(v);
            if (m) return { email: m[1].toLowerCase() };
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { email: v.toLowerCase() };
            return { name: v };
        };
        var personHint = function (input) {
            var v = input.value.trim();
            var hint = input.parentNode.querySelector('.gcdoc-vissue-hint');
            hint.textContent = !v ? 'Blank - card prints with a line to write a name'
                : memberLabels[v] || personOf(v).email ? ''
                : 'Not picked from the member list - prints this name, but won\'t show in their voucher list';
        };
        var personCell = function () {
            return '<td class="person"><input data-person list="gcdoc-vi-members" placeholder="Start typing a name">' +
                '<div class="gcdoc-vissue-hint">Blank - card prints with a line to write a name</div></td>';
        };

        var post = function (action, payload) {
            var data = new FormData();
            data.append('action', action);
            data.append('nonce', cfg.nonce);
            data.append('payload', JSON.stringify(payload));
            return fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: data })
                .then(function (res) { return res.json().catch(function () { return { success: false }; }); })
                .then(function (json) {
                    if (!json.success) {
                        var err = new Error((json.data && json.data.message) || 'Something went wrong. Please try again.');
                        err.duplicate = !!(json.data && json.data.duplicate);
                        throw err;
                    }
                    return json.data;
                });
        };

        // skipConfirm: re-sending after the "already issued - issue anyway?" question
        var issue = function (form, payload, question, skipConfirm) {
            if (!skipConfirm && !confirm(question)) return;
            var button = form.querySelector('.gcdoc-vissue-submit');
            var label = button.textContent;
            button.disabled = true;
            button.textContent = 'Issuing...';
            showMsg('', true);
            post('gcdoc_voucher_issue', payload)
                .then(function (res) {
                    var url = new URL(cfg.pageUrl, location.href);
                    url.searchParams.set('gcdoc_set', res.setId);
                    url.searchParams.set('issued', res.voucherCount);
                    if (res.hours) url.searchParams.set('hours', res.hours);
                    location.href = url.toString();
                })
                .catch(function (e) {
                    button.disabled = false;
                    button.textContent = label;
                    // Instructor session name used before (e.g. typed after the CSV was checked) - ask, don't block
                    if (e.duplicate) {
                        showMsg('', true);
                        if (confirm('"' + payload.sessionName + '" has already been issued before. That\'s fine if this is a separate file ' +
                            '(e.g. another sport), but uploading the same file again would duplicate vouchers and hours. Issue anyway?')) {
                            issue(form, Object.assign({}, payload, { confirmDuplicate: true }), question, true);
                        }
                        return;
                    }
                    showMsg(e.message, false);
                });
        };

        // Tabs
        root.querySelectorAll('.gcdoc-vissue-tabs button').forEach(function (tab) {
            tab.addEventListener('click', function () {
                root.querySelectorAll('.gcdoc-vissue-tabs button').forEach(function (t) { t.classList.toggle('is-active', t === tab); });
                root.querySelectorAll('.gcdoc-vissue-form').forEach(function (f) { f.hidden = f.getAttribute('data-kind') !== tab.getAttribute('data-tab'); });
                showMsg('', true);
            });
        });

        var removeButton = '<td><button type="button" class="gcdoc-vissue-remove" title="Remove">×</button></td>';
        var wireRow = function (tr, onChange) {
            tr.querySelector('.gcdoc-vissue-remove').addEventListener('click', function () { tr.remove(); onChange(); });
            tr.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', onChange); });
            var person = tr.querySelector('[data-person]');
            if (person) person.addEventListener('input', function () { personHint(person); });
        };

        // --- Trial workers ---
        (function () {
            var form = root.querySelector('form[data-kind="trial"]');
            var tbody = form.querySelector('tbody');
            var days = function () { return num(form.elements.days.value); };

            var update = function () {
                var total = 0, roles = 0;
                tbody.querySelectorAll('tr').forEach(function (tr) {
                    var t = num(tr.querySelector('[data-per-day]').value) * days();
                    tr.querySelector('.total').textContent = t;
                    if (tr.querySelector('[data-role]').value.trim() && t > 0) { total += t; roles++; }
                });
                form.querySelector('.gcdoc-vissue-empty').hidden = tbody.children.length > 0;
                form.querySelector('.gcdoc-vissue-summary').textContent = total + ' voucher' + (total === 1 ? '' : 's') + ' across ' + roles + ' role' + (roles === 1 ? '' : 's');
            };
            var addRole = function (role, perDay) {
                var tr = document.createElement('tr');
                tr.innerHTML = '<td><input data-role value="' + esc(role) + '" placeholder="Role"></td>' + personCell() +
                    '<td class="num"><input data-per-day type="number" min="0" max="20" value="' + esc(perDay) + '" class="num-input"></td>' +
                    '<td class="num total"></td>' + removeButton;
                tbody.appendChild(tr);
                wireRow(tr, update);
            };

            form.elements.trialType.addEventListener('change', function () {
                var input = this;
                var name = Object.keys(cfg.trialPresets).find(function (n) { return n.toLowerCase() === input.value.trim().toLowerCase(); });
                if (!name) return;
                var assigned = Array.prototype.some.call(tbody.querySelectorAll('[data-person]'), function (i) { return i.value.trim(); });
                if (assigned && !confirm('Replace the roles with the ' + name + ' defaults?')) return;
                input.value = name;
                tbody.innerHTML = '';
                cfg.trialPresets[name].forEach(function (r) { addRole(r[0], r[1]); });
                update();
            });
            form.elements.days.addEventListener('input', update);
            form.querySelector('[data-add-row]').addEventListener('click', function () { addRole('', 1); update(); });
            update();

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var rows = [], total = 0;
                tbody.querySelectorAll('tr').forEach(function (tr) {
                    var role = tr.querySelector('[data-role]').value.trim();
                    var perDay = num(tr.querySelector('[data-per-day]').value);
                    if (!role || !perDay) return;
                    total += perDay * days();
                    rows.push(Object.assign({ role: role, perDay: perDay }, personOf(tr.querySelector('[data-person]').value)));
                });
                if (!rows.length) { showMsg('Add at least one role with vouchers.', false); return; }
                var label = form.elements.trialType.value.trim() + ' ' + form.elements.trialDates.value.trim();
                var type = form.elements.voucherType.value;
                issue(form, {
                    kind: 'trial',
                    trialType: form.elements.trialType.value,
                    trialDates: form.elements.trialDates.value,
                    days: days(),
                    voucherType: type,
                    fiscalYear: form.elements.fiscalYear.value,
                    rows: rows
                }, 'Issue ' + total + ' ' + (type === 'class' ? 'service' : 'Blue Ribbon') + ' vouchers for the ' + label + ' trial?');
            });
        })();

        // --- One-off ---
        (function () {
            var form = root.querySelector('form[data-kind="oneoff"]');
            var tbody = form.querySelector('tbody');

            var update = function () {
                var total = 0, people = 0;
                tbody.querySelectorAll('tr').forEach(function (tr) {
                    var n = num(tr.querySelector('[data-count]').value);
                    if (n) { total += n; people++; }
                });
                form.querySelector('.gcdoc-vissue-summary').textContent = total + ' voucher' + (total === 1 ? '' : 's') + ' for ' + people + (people === 1 ? ' person' : ' people');
            };
            var addPerson = function () {
                var tr = document.createElement('tr');
                tr.innerHTML = personCell() +
                    '<td class="num"><input data-count type="number" min="0" max="20" value="' + esc(num(form.elements.perPerson.value) || 1) + '" class="num-input"></td>' + removeButton;
                tbody.appendChild(tr);
                wireRow(tr, update);
            };
            // Changing "Each" resets every row's count to it
            var applyPerPerson = function () {
                tbody.querySelectorAll('[data-count]').forEach(function (i) { i.value = num(form.elements.perPerson.value); });
                update();
            };

            form.elements.reason.addEventListener('change', function () {
                var input = this;
                var name = Object.keys(cfg.reasonPresets).find(function (n) { return n.toLowerCase() === input.value.trim().toLowerCase(); });
                if (!name) return;
                input.value = name;
                form.elements.voucherType.value = cfg.reasonPresets[name].type;
                form.elements.perPerson.value = cfg.reasonPresets[name].perPerson;
                applyPerPerson();
            });
            form.elements.perPerson.addEventListener('change', applyPerPerson);
            form.querySelector('[data-add-row]').addEventListener('click', function () { addPerson(); update(); });
            addPerson();
            update();

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var rows = [], total = 0;
                tbody.querySelectorAll('tr').forEach(function (tr) {
                    var count = num(tr.querySelector('[data-count]').value);
                    if (!count) return;
                    total += count;
                    rows.push(Object.assign({ count: count }, personOf(tr.querySelector('[data-person]').value)));
                });
                if (!rows.length) { showMsg('Add at least one person with vouchers.', false); return; }
                var type = form.elements.voucherType.value;
                var reason = form.elements.reason.value.trim();
                issue(form, {
                    kind: 'oneoff',
                    reason: reason,
                    voucherType: type,
                    fiscalYear: form.elements.fiscalYear.value,
                    rows: rows
                }, 'Issue ' + total + ' ' + (type === 'class' ? 'service' : 'Blue Ribbon') + ' vouchers for "' + reason + '"?');
            });
        })();

        // --- Instructors (registrar's CSV) ---
        (function () {
            var form = root.querySelector('form[data-kind="instructor"]');
            var review = form.querySelector('[data-review]');
            var MIN_WEEKS = 5, HOURS_PER_WEEK = 1, SESSION_WEEKS = 7;
            var rows = [];
            var duplicate = false;
            var checkedName = ''; // the session name the duplicate check above was for

            var fyOfDate = function (iso) { var p = iso.split('-').map(Number); return p[1] >= 10 ? p[0] : p[0] - 1; };
            var fyLabel = function (y) { return 'FY' + String(Number(y) + 1).slice(-2); };

            // Same as vouchersStore.instructorLogDate: a session ending outside the chosen FY gets its
            // hours dated Oct 1 / Sep 30 of that FY, so they count with the vouchers
            var updateDateNote = function () {
                var note = form.querySelector('[data-date-note]');
                var date = form.elements.sessionDate.value;
                var fy = Number(form.elements.fiscalYear.value);
                if (!date || fyOfDate(date) === fy) { note.hidden = true; return; }
                note.hidden = false;
                note.textContent = 'This session ended in ' + fyLabel(fyOfDate(date)) + ' but counts toward ' + fyLabel(fy) +
                    ', so the hours will be dated ' + (fyOfDate(date) < fy ? 'Oct 1, ' + fy : 'Sep 30, ' + (fy + 1)) + ' to count in ' + fyLabel(fy) + ' with the vouchers.';
            };
            form.elements.sessionDate.addEventListener('change', function () {
                if (this.value) {
                    var fy = String(fyOfDate(this.value));
                    if (Array.prototype.some.call(form.elements.fiscalYear.options, function (o) { return o.value === fy; })) form.elements.fiscalYear.value = fy;
                }
                updateDateNote();
            });
            form.elements.fiscalYear.addEventListener('change', updateDateNote);

            form.querySelector('[data-template]').addEventListener('click', function () {
                var blob = new Blob(['Class,Instructor,Weeks Attended,Email (optional)\r\n'], { type: 'text/csv;charset=utf-8;' });
                var link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'instructor_vouchers_template.csv';
                document.body.appendChild(link);
                link.click();
                link.remove();
            });

            // Minimal CSV reader: quoted fields, doubled quotes, CRLF, Excel's BOM
            var parseCsv = function (text) {
                text = text.replace(/^﻿/, '');
                var out = [], row = [], field = '', quoted = false;
                for (var i = 0; i < text.length; i++) {
                    var c = text[i];
                    if (quoted) {
                        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
                    } else if (c === '"') quoted = true;
                    else if (c === ',') { row.push(field); field = ''; }
                    else if (c === '\n' || c === '\r') {
                        if (c === '\r' && text[i + 1] === '\n') i++;
                        row.push(field); out.push(row); row = []; field = '';
                    } else field += c;
                }
                if (field !== '' || row.length) { row.push(field); out.push(row); }
                return out.filter(function (r) { return r.some(function (f) { return f.trim() !== ''; }); });
            };

            var weeksOk = function (r) { return r.weeks !== null && r.weeks !== undefined; };

            var render = function () {
                if (!rows.length) { review.innerHTML = ''; summary(); return; }
                var options = '<option value="">- pick a member -</option>' + cfg.members.map(function (m) {
                    return '<option value="' + esc(m.email) + '">' + esc(m.label) + '</option>';
                }).join('');
                review.innerHTML = (duplicate ? '<p class="gcdoc-vissue-warn">⚠️ "' + esc(form.elements.sessionName.value.trim()) +
                    '" has been issued before. That\'s fine for a separate file (e.g. another sport) - just make sure this isn\'t the same file again, ' +
                    'or the vouchers and hours will be duplicated.</p>' : '') +
                    '<table class="gcdoc-vissue-table"><thead><tr><th></th><th>Class</th><th>Instructor (from file)</th><th>Member</th>' +
                    '<th class="num">Weeks</th><th class="num">Voucher</th><th class="num">Hours</th></tr></thead><tbody>' +
                    rows.map(function (r, i) {
                        return '<tr data-i="' + i + '">' +
                            '<td><input type="checkbox" data-include' + (r.include ? ' checked' : '') + ' title="Include this row"></td>' +
                            '<td>' + esc(r.className) + '</td><td>' + esc(r.instructorName) + '</td>' +
                            '<td class="person"><select data-member>' + options + '</select><div class="gcdoc-vissue-hint"></div></td>' +
                            '<td class="num' + (weeksOk(r) ? '' : ' bad') + '">' + esc(r.weeksText || '(blank)') + '</td>' +
                            '<td class="num">' + (weeksOk(r) && r.weeks >= MIN_WEEKS ? '1' : '—') + '</td>' +
                            '<td class="num">' + (weeksOk(r) ? r.weeks * HOURS_PER_WEEK : '—') + '</td></tr>';
                    }).join('') + '</tbody></table>';

                review.querySelectorAll('tr[data-i]').forEach(function (tr) {
                    var r = rows[Number(tr.getAttribute('data-i'))];
                    var select = tr.querySelector('[data-member]');
                    // A matched member who isn't in the directory list (e.g. an Applicant hidden from it)
                    if (r.memberEmail && !select.querySelector('option[value="' + CSS.escape(r.memberEmail) + '"]')) {
                        select.insertAdjacentHTML('beforeend', '<option value="' + esc(r.memberEmail) + '">' + esc(r.instructorName + ' (' + r.memberEmail + ')') + '</option>');
                    }
                    select.value = r.memberEmail || '';
                    var paint = function () {
                        tr.classList.toggle('is-excluded', !r.include);
                        tr.classList.toggle('is-unmatched', r.include && !r.memberEmail);
                        tr.querySelector('.gcdoc-vissue-hint').textContent = r.include && !r.memberEmail ? (r.matchNote || 'No matching member - pick one') : '';
                        summary();
                    };
                    select.addEventListener('change', function () { r.memberEmail = select.value; paint(); });
                    tr.querySelector('[data-include]').addEventListener('change', function () { r.include = this.checked; paint(); });
                    paint();
                });
            };

            var included = function () { return rows.filter(function (r) { return r.include; }); };
            var blockers = function () {
                var out = [];
                if (!form.elements.sessionName.value.trim()) out.push('Enter a session name');
                if (!form.elements.sessionDate.value) out.push('Enter the session end date');
                if (!rows.length) out.push('Upload the registrar\'s CSV');
                if (included().some(function (r) { return !weeksOk(r); })) out.push('Fix weeks that aren\'t a whole number from 0 to ' + SESSION_WEEKS + ' in the file (or uncheck those rows)');
                if (included().some(function (r) { return !r.memberEmail; })) out.push('Pick a member for every highlighted row (or uncheck it)');
                if (rows.length && !included().length) out.push('No rows included');
                return out;
            };
            var totals = function () {
                var v = 0, h = 0;
                included().forEach(function (r) { if (weeksOk(r)) { h += r.weeks * HOURS_PER_WEEK; if (r.weeks >= MIN_WEEKS) v++; } });
                return { vouchers: v, hours: h };
            };
            var summary = function () {
                var t = totals(), b = blockers();
                form.querySelector('.gcdoc-vissue-summary').innerHTML = rows.length
                    ? included().length + ' rows · <strong>' + t.vouchers + '</strong> Blue Ribbon vouchers · <strong>' + t.hours + '</strong> service hours' +
                      (b.length ? ' · <span class="gcdoc-vissue-warn-text">' + esc(b[0]) + '</span>' : '')
                    : '';
                form.querySelector('.gcdoc-vissue-submit').disabled = b.length > 0;
            };
            form.elements.sessionName.addEventListener('input', summary);
            form.elements.sessionDate.addEventListener('change', summary);

            var preview = function (fileRows) {
                showMsg('Matching instructors to members...', true);
                var name = form.elements.sessionName.value.trim();
                return post('gcdoc_voucher_preview', { sessionName: name, rows: fileRows })
                    .then(function (res) {
                        duplicate = !!res.duplicate;
                        checkedName = name;
                        rows = res.rows.map(function (r) { return Object.assign({ include: true }, r); });
                        showMsg('', true);
                        render();
                    });
            };

            form.elements.csv.addEventListener('change', function () {
                var file = this.files[0];
                var input = this;
                rows = [];
                render();
                if (!file) return;
                file.text().then(function (text) {
                    var table = parseCsv(text);
                    var headers = (table[0] || []).map(function (h) { return h.trim(); });
                    var find = function (patterns) { return headers.findIndex(function (h) { return patterns.some(function (p) { return p.test(h); }); }); };
                    var classCol = find([/^class/i]);
                    var instructorCol = find([/^instructor/i, /^name$/i]);
                    var weeksCol = find([/week/i, /attended/i, /^classes/i]);
                    var emailCol = find([/email/i]);
                    if (classCol < 0 || instructorCol < 0 || weeksCol < 0) {
                        throw new Error('The file needs Class, Instructor, and Weeks Attended columns. Found: ' + (headers.join(', ') || 'none') + '.');
                    }
                    var fileRows = table.slice(1)
                        .filter(function (r) { return (r[instructorCol] || '').trim(); })
                        .map(function (r) {
                            return {
                                className: (r[classCol] || '').trim(),
                                instructorName: (r[instructorCol] || '').trim(),
                                weeks: (r[weeksCol] || '').trim(),
                                email: emailCol >= 0 ? (r[emailCol] || '').trim() : ''
                            };
                        });
                    if (!fileRows.length) throw new Error('No instructor rows found in that file.');
                    return preview(fileRows);
                }).catch(function (e) {
                    showMsg(e.message, false);
                }).then(function () { input.value = ''; });
            });

            summary();

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                if (blockers().length) { showMsg(blockers()[0], false); return; }
                var t = totals();
                var name = form.elements.sessionName.value.trim();
                // Warned about on the review table already, so confirming here covers it; the server
                // still asks if the name was changed after the file was checked
                issue(form, {
                    kind: 'instructor',
                    sessionName: name,
                    sessionDate: form.elements.sessionDate.value,
                    fiscalYear: form.elements.fiscalYear.value,
                    confirmDuplicate: duplicate && name === checkedName,
                    rows: included().map(function (r) {
                        return { className: r.className, instructorName: r.instructorName, email: r.memberEmail, weeks: r.weeks };
                    })
                }, (duplicate && name === checkedName ? '"' + name + '" has been issued before. ' : '') +
                    'Issue ' + t.vouchers + ' Blue Ribbon vouchers and ' + t.hours + ' service hours for ' + name +
                    ', counting toward ' + fyLabel(form.elements.fiscalYear.value) + '?');
            });
        })();
    })();
    </script>
    <?php
    return ob_get_clean();
}

// AJAX endpoints for [gcdoc_voucher_issue]. Registered for logged-out visitors too, because a PIN
// device doesn't have to be logged in to WordPress - every handler checks gcdoc_admin_actor().
function gcdoc_voucher_ajax_start() {
    check_ajax_referer('gcdoc_voucher_issue', 'nonce');
    $actor = gcdoc_admin_actor();
    if ($actor === null) {
        wp_send_json_error(['message' => 'This device isn\'t unlocked for club-admin tasks. Reload the page and enter the admin PIN.'], 403);
    }
    $payload = json_decode(wp_unslash($_POST['payload'] ?? ''), true);
    return [$actor, is_array($payload) ? $payload : []];
}

function gcdoc_ajax_voucher_issue() {
    [$actor, $payload] = gcdoc_voucher_ajax_start();
    $fields = ['kind', 'fiscalYear', 'voucherType', 'trialType', 'trialDates', 'days', 'reason', 'sessionName', 'sessionDate', 'rows', 'confirmDuplicate'];
    $body = array_intersect_key($payload, array_flip($fields));
    $body['action'] = 'issue';
    $body['issuedBy'] = $actor;

    $result = gcdoc_voucher_issue_call($body);
    if (is_wp_error($result)) {
        // A timeout doesn't prove nothing was written
        wp_send_json_error(['message' => 'The voucher system didn\'t answer. It may still have gone through - check with the portal admin before issuing again.'], 502);
    }
    if (!empty($result['duplicate'])) {
        // Instructor session name already used - the page asks, then resends with confirmDuplicate
        wp_send_json_error(['duplicate' => true, 'message' => 'This session name has already been issued.'], 409);
    }
    if (empty($result['ok'])) {
        wp_send_json_error(['message' => $result['error'] ?? 'Could not issue vouchers.'], 400);
    }
    wp_send_json_success($result);
}
add_action('wp_ajax_gcdoc_voucher_issue', 'gcdoc_ajax_voucher_issue');
add_action('wp_ajax_nopriv_gcdoc_voucher_issue', 'gcdoc_ajax_voucher_issue');

function gcdoc_ajax_voucher_preview() {
    [, $payload] = gcdoc_voucher_ajax_start();
    $result = gcdoc_voucher_issue_call([
        'action' => 'preview_instructor',
        'sessionName' => $payload['sessionName'] ?? '',
        'rows' => $payload['rows'] ?? [],
    ]);
    if (is_wp_error($result)) {
        wp_send_json_error(['message' => 'Couldn\'t match instructors to members right now. Please try again.'], 502);
    }
    wp_send_json_success($result);
}
add_action('wp_ajax_gcdoc_voucher_preview', 'gcdoc_ajax_voucher_preview');
add_action('wp_ajax_nopriv_gcdoc_voucher_preview', 'gcdoc_ajax_voucher_preview');

// Publish: stored status 'printed'
function gcdoc_ajax_voucher_mark_printed() {
    [, $payload] = gcdoc_voucher_ajax_start();
    $result = gcdoc_voucher_issue_call(['action' => 'mark_printed', 'codes' => $payload['codes'] ?? []]);
    if (is_wp_error($result)) {
        wp_send_json_error(['message' => 'The voucher system didn\'t answer. Please try again.'], 502);
    }
    wp_send_json_success($result);
}
add_action('wp_ajax_gcdoc_voucher_mark_printed', 'gcdoc_ajax_voucher_mark_printed');
add_action('wp_ajax_nopriv_gcdoc_voucher_mark_printed', 'gcdoc_ajax_voucher_mark_printed');

// Only works while nothing in the set is published - voucher-issue.js enforces that
function gcdoc_ajax_voucher_delete_set() {
    [, $payload] = gcdoc_voucher_ajax_start();
    $result = gcdoc_voucher_issue_call(['action' => 'delete_set', 'setId' => $payload['setId'] ?? '']);
    if (is_wp_error($result)) {
        wp_send_json_error(['message' => 'The voucher system didn\'t answer. Reload the page to see whether the set is still there.'], 502);
    }
    if (empty($result['ok'])) {
        wp_send_json_error(['message' => $result['error'] ?? 'Could not delete the set.'], 400);
    }
    wp_send_json_success($result);
}
add_action('wp_ajax_gcdoc_voucher_delete_set', 'gcdoc_ajax_voucher_delete_set');
add_action('wp_ajax_nopriv_gcdoc_voucher_delete_set', 'gcdoc_ajax_voucher_delete_set');

function gcdoc_hours_styles() {
    ?>
    <style>
        .gcdoc-hours-report .gcdoc-fy-section { margin-bottom: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.75rem; }
        .gcdoc-hours-report summary { cursor: pointer; padding: 0.25rem 0; }
        .gcdoc-hours-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
        .gcdoc-hours-table th, .gcdoc-hours-table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; }
        .gcdoc-dues-summary h3 { margin-top: 0; }
        .gcdoc-dues-amount { font-size: 1.05rem; font-weight: 400; }
        .gcdoc-dues-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
        .gcdoc-dues-table th, .gcdoc-dues-table td { text-align: left; padding: 0.35rem 0.6rem; border-bottom: 1px solid #e5e7eb; }
        .gcdoc-dues-current { background: #dbeafe; font-weight: 600; }
        .gcdoc-dues-pay { margin-top: 0.75rem; margin-bottom: 0; display: flex; flex-wrap: wrap; gap: 0.6rem; }
        .gcdoc-pay-dues-btn { display: inline-block; background: #16a34a; color: #fff !important; text-decoration: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: 700; }
        .gcdoc-pay-dues-btn:hover, .gcdoc-pay-dues-btn:focus, .gcdoc-pay-dues-btn:active, .gcdoc-pay-dues-btn:visited { background: #15803d; color: #fff !important; }
        .gcdoc-enter-hours-btn { display: inline-block; background: #fff; color: #1f2937 !important; text-decoration: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: 700; border: 2px solid #1f2937; }
        .gcdoc-enter-hours-btn:hover, .gcdoc-enter-hours-btn:focus, .gcdoc-enter-hours-btn:active, .gcdoc-enter-hours-btn:visited { background: #1f2937; color: #fff !important; }
        .gcdoc-dues-owed {
            font-size: 1.2rem;
            font-weight: 700;
            line-height: 1.4;
            padding: 1rem 1.25rem;
            border-radius: 8px;
            border: 2px solid;
            margin: 1rem 0 1.5rem;
        }
        .gcdoc-dues-owed-unpaid { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
        .gcdoc-dues-owed-paid { background: #f0fdf4; border-color: #16a34a; color: #15803d; }
        .gcdoc-dues-owed-ineligible { background: #fef2f2; border-color: #dc2626; color: #b91c1c; }
        .gcdoc-dues-owed-ineligible a { color: #b91c1c; text-decoration: underline; }
        .gcdoc-dues-owed p { margin: 0; }
        .gcdoc-dues-steps { margin: 0.6rem 0 0 1.4rem; padding: 0; font-size: 1.05rem; font-weight: 400; }
        .gcdoc-dues-steps li { margin-bottom: 0.3rem; }
        .gcdoc-login-prompt { font-weight: 600; }
        .gcdoc-login-prompt a { color: #2563eb; text-decoration: underline; }
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
        /* Narrow for the scan/lookup parts; the member's voucher list gets the full width for 2 columns of cards */
        .gcdoc-voucher > *:not(.gcdoc-my-vouchers) { max-width: 460px; }
        .gcdoc-voucher-msg { padding: 0.75rem 1rem; border-radius: 6px; font-weight: 600; border: 2px solid; }
        .gcdoc-voucher-msg-ok { background: #f0fdf4; border-color: #16a34a; color: #15803d; }
        .gcdoc-voucher-msg-bad { background: #fef2f2; border-color: #dc2626; color: #b91c1c; }
        .gcdoc-voucher-card { border: 2px solid #1f2937; border-left-width: 10px; border-radius: 8px; padding: 1rem 1.1rem; margin: 1rem 0; background: #fff; }
        .gcdoc-voucher-card.is-blue { border-left-color: #2563eb; }
        .gcdoc-voucher-type { font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #4b5563; }
        .gcdoc-voucher-value { font-size: 1.35rem; font-weight: 800; margin: 0.2rem 0 0.5rem; }
        .gcdoc-voucher-alt { font-size: 0.9rem; font-weight: 600; color: #1d4ed8; margin: -0.3rem 0 0.5rem; }
        .gcdoc-voucher-name { font-size: 1.1rem; font-weight: 700; }
        .gcdoc-voucher-name span { font-weight: 400; font-size: 0.9rem; color: #4b5563; }
        .gcdoc-voucher-meta { font-size: 0.85rem; color: #4b5563; margin-top: 0.25rem; }
        .gcdoc-voucher-status { margin-top: 0.9rem; padding: 0.6rem 0.8rem; border-radius: 6px; font-weight: 800; font-size: 1.05rem; }
        .gcdoc-voucher-valid { background: #f0fdf4; color: #15803d; }
        .gcdoc-voucher-used { background: #fef2f2; color: #b91c1c; }
        .gcdoc-voucher-redeem { margin-top: 0.9rem; }
        .gcdoc-voucher-btn { width: 100%; padding: 0.9rem; font-size: 1.15rem; font-weight: 800; background: #16a34a; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
        .gcdoc-voucher-btn-secondary { padding: 0.55rem 1rem; font-weight: 700; background: #fff; color: #1f2937; border: 2px solid #1f2937; border-radius: 6px; cursor: pointer; }
        .gcdoc-voucher-pin, .gcdoc-voucher-lookup { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.5rem; margin-top: 0.9rem; }
        .gcdoc-voucher-pin label, .gcdoc-voucher-lookup label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; flex: 1; min-width: 180px; }
        .gcdoc-voucher-pin input, .gcdoc-voucher-lookup input { padding: 0.55rem 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; letter-spacing: 0.08em; }

        /* Voucher cards (screen preview + print) - same 3.5in x 2in card as the portal's VoucherPrint.vue */
        .gcdoc-voucher-lookup-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.1rem; margin: 1rem 0; background: #f9fafb; }
        .gcdoc-voucher-lookup-box h3 { margin: 0 0 0.25rem; font-size: 1.1rem; }
        .gcdoc-voucher-lookup-box p { margin: 0; font-size: 0.9rem; color: #4b5563; }
        .gcdoc-voucher-lookup-box .gcdoc-voucher-lookup { margin-top: 0.6rem; }
        .gcdoc-my-vouchers { margin-top: 2rem; padding-top: 1.25rem; border-top: 2px solid #e5e7eb; }
        .gcdoc-my-vouchers h3 { margin-top: 0; }
        .gcdoc-vcard-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
        .gcdoc-vcard-tip { font-size: 0.85rem; color: #6b7280; }
        .gcdoc-vcards { display: grid; grid-template-columns: repeat(2, max-content); gap: 0.75rem; margin-top: 0.75rem; }
        @media (max-width: 760px) { .gcdoc-vcards { grid-template-columns: max-content; } }
        .gcdoc-vcard-item { display: flex; flex-direction: column; gap: 0.25rem; max-width: 100%; }
        .gcdoc-vcard-select { font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem; }
        .gcdoc-vcard { box-sizing: border-box; width: 3.5in; max-width: 100%; height: 2in; border: 1px dashed #bbb; padding: 0.14in 0.16in; display: flex; gap: 0.1in; overflow: hidden; background: #fff; color: #111827; font-family: system-ui, -apple-system, sans-serif; line-height: 1.2; text-align: left; }
        .gcdoc-vcard.is-blue { border-left: 0.12in solid #1d4ed8; padding-left: 0.12in; }
        .gcdoc-vcard-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .gcdoc-vcard-org { font-size: 7pt; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #374151; }
        .gcdoc-vcard-value { font-size: 12pt; font-weight: 800; margin: 0.04in 0 0.08in; line-height: 1.1; }
        .gcdoc-vcard-name { font-size: 10.5pt; font-weight: 700; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gcdoc-vcard-write-in { font-weight: 600; font-size: 8pt; color: #374151; border-bottom: 1px solid #000; padding-top: 0.12in; padding-bottom: 0.02in; }
        .gcdoc-vcard-household { font-size: 7.5pt; color: #374151; }
        .gcdoc-vcard-meta { font-size: 7pt; line-height: 1.2; color: #374151; margin-top: auto; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .gcdoc-vcard-fine { font-size: 6pt; color: #6b7280; }
        .gcdoc-vcard-alt { font-weight: 700; color: #374151; }
        .gcdoc-vcard-qr { width: 0.95in; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .gcdoc-vcard-qr svg { display: block; width: 0.9in !important; height: 0.9in !important; max-width: none; margin: 0; }
        .gcdoc-vcard-code { font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; margin-top: 0.04in; }
        #gcdoc-print-root { display: none; }
        @media print {
            body.gcdoc-printing { margin: 0 !important; padding: 0 !important; background: #fff !important; }
            body.gcdoc-printing > *:not(#gcdoc-print-root) { display: none !important; }
            body.gcdoc-printing #gcdoc-print-root { display: block; }
            .gcdoc-print-page { width: 8.5in; height: 11in; box-sizing: border-box; padding: 0.5in; display: grid; grid-template-columns: repeat(2, 3.5in); column-gap: 0.5in; align-content: start; break-after: page; }
            .gcdoc-print-page:last-child { break-after: auto; }
            .gcdoc-print-col { display: flex; flex-direction: column; }
            .gcdoc-print-col .gcdoc-vcard { max-width: none; }
            #gcdoc-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        /* [gcdoc_voucher_issue] */
        .gcdoc-vissue-who { font-size: 0.9rem; color: #4b5563; }
        .gcdoc-vissue-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0; border-bottom: 2px solid #e5e7eb; }
        .gcdoc-vissue-tabs button { background: none; border: none; border-bottom: 3px solid transparent; margin-bottom: -2px; padding: 0.5rem 0.8rem; font-weight: 700; color: #6b7280; cursor: pointer; }
        .gcdoc-vissue-tabs button.is-active { color: #1f2937; border-bottom-color: #4f46e5; }
        .gcdoc-vissue-fields { display: flex; flex-wrap: wrap; gap: 0.6rem; }
        .gcdoc-vissue-fields label { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 150px; font-size: 0.8rem; font-weight: 600; color: #4b5563; }
        .gcdoc-vissue-fields label.narrow { flex: 0 0 100px; min-width: 100px; }
        .gcdoc-vissue input, .gcdoc-vissue select { padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; max-width: 100%; }
        .gcdoc-vissue-table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.875rem; }
        .gcdoc-vissue-table th { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #e5e7eb; }
        .gcdoc-vissue-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .gcdoc-vissue-table td input:not([type="checkbox"]), .gcdoc-vissue-table td select { width: 100%; }
        .gcdoc-vissue-table .num { text-align: right; }
        .gcdoc-vissue-table .num-input { width: 4.5rem; text-align: center; }
        .gcdoc-vissue-table .person { min-width: 200px; }
        .gcdoc-vissue-table .bad { color: #b91c1c; font-weight: 700; }
        .gcdoc-vissue-table tr.is-unmatched td { background: #fef2f2; }
        .gcdoc-vissue-table tr.is-excluded td { opacity: 0.45; }
        .gcdoc-vissue-hint { font-size: 0.75rem; color: #b45309; margin-top: 0.15rem; }
        .gcdoc-vissue-remove { background: none; border: none; color: #9ca3af; font-size: 1.25rem; cursor: pointer; }
        .gcdoc-vissue-remove:hover { color: #dc2626; }
        .gcdoc-vissue-empty { color: #6b7280; font-style: italic; }
        .gcdoc-vissue-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-top: 0.75rem; }
        .gcdoc-vissue-summary { flex: 1; font-size: 0.875rem; color: #374151; }
        .gcdoc-vissue-submit { background: #4f46e5; color: #fff; border: none; padding: 0.6rem 1.1rem; border-radius: 6px; font-weight: 700; cursor: pointer; }
        .gcdoc-vissue-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .gcdoc-vissue-intro { font-size: 0.9rem; color: #374151; }
        .gcdoc-vissue-link { background: none; border: none; color: #4f46e5; font-weight: 700; cursor: pointer; padding: 0; }
        .gcdoc-vissue-note { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.875rem; }
        .gcdoc-vissue-warn { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.875rem; font-weight: 600; }
        .gcdoc-vissue-warn-text { color: #b45309; }
        .gcdoc-vissue-msg { margin-top: 0.6rem; font-weight: 600; min-height: 1.2em; }
        @media (max-width: 640px) { .gcdoc-vissue-table { display: block; overflow-x: auto; } }
    </style>
    <?php
}
add_action('wp_footer', 'gcdoc_hours_styles');


