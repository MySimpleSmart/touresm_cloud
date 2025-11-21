<?php
/**
 * Plugin Name: Touresm DB Layer
 * Description: Custom tables + PODs sync + Full REST API for Touresm Listings & Bookings.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) exit;

class Touresm_DB_Layer {

    public function __construct() {
        register_activation_hook(__FILE__, [$this, 'activate']);

        // LISTING POD SYNC - try multiple hooks
        add_action('pods_api_post_save_pod_item_listing', [$this, 'sync_listing'], 10, 3);
        add_action('pods_api_post_save_pod_item_touresm-listing', [$this, 'sync_listing'], 10, 3);
        // Fallback: sync on post save
        add_action('save_post_listing', [$this, 'sync_listing_on_save'], 10, 1);
        
        // BOOKING POD SYNC - try multiple hooks
        add_action('pods_api_post_save_pod_item_booking', [$this, 'sync_booking'], 10, 3);
        add_action('pods_api_post_save_pod_item_listing_booking', [$this, 'sync_booking'], 10, 3);
        // Fallback: sync on post save
        add_action('save_post_listing_booking', [$this, 'sync_booking_on_save'], 10, 1);

        // REST API
        add_action('rest_api_init', [$this, 'api_routes']);

        // Admin menu for bulk sync
        add_action('admin_menu', [$this, 'add_admin_menu']);

        // WP-CLI support
        if (defined('WP_CLI') && WP_CLI && class_exists('WP_CLI')) {
            \WP_CLI::add_command('touresm sync-listings', [$this, 'wpcli_sync_listings']);
            \WP_CLI::add_command('touresm sync-bookings', [$this, 'wpcli_sync_bookings']);
            \WP_CLI::add_command('touresm sync-all', [$this, 'wpcli_sync_all']);
        }
    }

    /**
     * Fallback sync for listings on post save
     */
    public function sync_listing_on_save($post_id) {
        // Prevent infinite loops
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (wp_is_post_revision($post_id)) return;
        
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'listing') return;
        
        // Call sync with dummy parameters
        $this->sync_listing([], false, $post_id);
    }

    /**
     * Fallback sync for bookings on post save
     */
    public function sync_booking_on_save($post_id) {
        // Prevent infinite loops
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (wp_is_post_revision($post_id)) return;
        
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'listing_booking') return;
        
        // Call sync with dummy parameters
        $this->sync_booking([], false, $post_id);
    }

    /* -------------------------------------------------------
     * 1) INSTALL TABLES
     * ------------------------------------------------------- */
    public function activate() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();

        $listings = $wpdb->prefix . 'touresm_listings';
        $bookings = $wpdb->prefix . 'touresm_bookings';

        $sql1 = "CREATE TABLE $listings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            listing_post_id BIGINT UNSIGNED NOT NULL,
            listing_name VARCHAR(255),
            room_number INT,
            listing_bed_number INT,
            guest_max_number INT,
            listing_description LONGTEXT,
            listing_price DECIMAL(10,2),
            check_in_time VARCHAR(50),
            check_out_time VARCHAR(50),
            listing_gallery LONGTEXT,
            listing_social_url VARCHAR(255),
            listing_familiar_location VARCHAR(255),
            listing_video VARCHAR(255),
            admin_blocked_days LONGTEXT,
            host_blocked_days LONGTEXT,
            size_term_id BIGINT UNSIGNED NULL,
            location_term_id BIGINT UNSIGNED NULL,
            category_term_id BIGINT UNSIGNED NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_listing (listing_post_id)
        ) $charset;";

        $sql2 = "CREATE TABLE $bookings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            booking_post_id BIGINT UNSIGNED NOT NULL,
            related_listing_post_id BIGINT UNSIGNED NOT NULL,
            customer_name VARCHAR(255),
            customer_mobile VARCHAR(50),
            check_in_date DATE,
            check_out_date DATE,
            guest_number INT,
            booking_description LONGTEXT,
            paid_amount DECIMAL(10,2),
            paid_receipt VARCHAR(255),
            confirmation_status VARCHAR(50),
            confirmation_date DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_listing (related_listing_post_id),
            KEY idx_checkin (check_in_date)
        ) $charset;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql1);
        dbDelta($sql2);
    }

    private function get_tax_term($post_id, $taxonomy) {
        $terms = wp_get_post_terms($post_id, $taxonomy, ['fields'=>'ids']);
        return (!empty($terms) && !is_wp_error($terms)) ? (int)$terms[0] : null;
    }

    /**
     * Safely get Pod field value, handling arrays, objects, and relationships
     */
    private function get_pod_field($pod, $field_name, $default = null) {
        if (!$pod) return $default;
        
        $value = $pod->field($field_name);
        
        // If null or empty, try post meta as fallback
        if (empty($value) && $pod->id()) {
            $value = get_post_meta($pod->id(), $field_name, true);
        }
        
        // Handle relationship fields (return ID or first ID from array)
        if (is_array($value) && !empty($value)) {
            // If it's an array of objects with 'ID' property
            if (isset($value[0]) && is_object($value[0]) && isset($value[0]->ID)) {
                return (int)$value[0]->ID;
            }
            // If it's an array of IDs
            if (isset($value[0]) && is_numeric($value[0])) {
                return (int)$value[0];
            }
            // If it's an associative array with 'id' key
            if (isset($value['id'])) {
                return (int)$value['id'];
            }
        }
        
        // Handle objects
        if (is_object($value)) {
            if (isset($value->ID)) {
                return (int)$value->ID;
            }
            if (isset($value->id)) {
                return (int)$value->id;
            }
            // Try to convert object to string/array
            $value = (array)$value;
            if (isset($value['ID'])) {
                return (int)$value['ID'];
            }
        }
        
        // Return as-is for strings, numbers, etc.
        return $value !== null && $value !== false && $value !== '' ? $value : $default;
    }

    /**
     * Get numeric value from Pod field
     */
    private function get_pod_numeric($pod, $field_name, $default = null) {
        $value = $this->get_pod_field($pod, $field_name, $default);
        if ($value === null || $value === '') return $default;
        return is_numeric($value) ? (float)$value : $default;
    }

    /**
     * Get integer value from Pod field
     */
    private function get_pod_int($pod, $field_name, $default = null) {
        $value = $this->get_pod_field($pod, $field_name, $default);
        if ($value === null || $value === '') return $default;
        return is_numeric($value) ? (int)$value : $default;
    }

    /* -------------------------------------------------------
     * 2) SYNC PODS → CUSTOM TABLE (LISTING)
     * ------------------------------------------------------- */
    public function sync_listing($pieces, $is_new, $post_id) {
        global $wpdb;

        $pod = pods('touresm-listing', $post_id);
        if (!$pod || !$pod->id()) {
            // Fallback: try alternative Pod name
            $pod = pods('listing', $post_id);
            if (!$pod || !$pod->id()) return;
        }

        $table = $wpdb->prefix . 'touresm_listings';

        // Get gallery field - handle array properly
        $gallery = $this->get_pod_field($pod, 'listing_gallery');
        if (is_array($gallery)) {
            $gallery = maybe_serialize($gallery);
        } elseif (!empty($gallery)) {
            $gallery = maybe_serialize($gallery);
        } else {
            $gallery = null;
        }

        // Get blocked days - handle arrays/strings
        $admin_blocked = $this->get_pod_field($pod, 'admin_blocked_days');
        $host_blocked = $this->get_pod_field($pod, 'host_blocked_days');
        
        if (is_array($admin_blocked)) {
            $admin_blocked = maybe_serialize($admin_blocked);
        } elseif (is_string($admin_blocked)) {
            // Already a string, keep as is
        } else {
            $admin_blocked = null;
        }
        
        if (is_array($host_blocked)) {
            $host_blocked = maybe_serialize($host_blocked);
        } elseif (is_string($host_blocked)) {
            // Already a string, keep as is
        } else {
            $host_blocked = null;
        }

        $wpdb->replace($table, [
            'listing_post_id' => $post_id,
            'listing_name' => $this->get_pod_field($pod, 'listing_name'),
            'room_number' => $this->get_pod_int($pod, 'room_number'),
            'listing_bed_number' => $this->get_pod_int($pod, 'listing_bed_number'),
            'guest_max_number' => $this->get_pod_int($pod, 'guest_max_number'),
            'listing_description' => $this->get_pod_field($pod, 'listing_description'),
            'listing_price' => $this->get_pod_numeric($pod, 'listing_price'),
            'check_in_time' => $this->get_pod_field($pod, 'check_in_time'),
            'check_out_time' => $this->get_pod_field($pod, 'check_out_time'),
            'listing_gallery' => $gallery,
            'listing_social_url' => $this->get_pod_field($pod, 'listing_social_url'),
            'listing_familiar_location' => $this->get_pod_field($pod, 'listing_familiar_location'),
            'listing_video' => $this->get_pod_field($pod, 'listing_video'),
            'admin_blocked_days' => $admin_blocked,
            'host_blocked_days' => $host_blocked,
            'size_term_id' => $this->get_tax_term($post_id, 'listing_size'),
            'location_term_id' => $this->get_tax_term($post_id, 'listing_location'),
            'category_term_id' => $this->get_tax_term($post_id, 'listing_category'),
        ], ['%d', '%s', '%d', '%d', '%d', '%s', '%f', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%d']);
    }

    /* -------------------------------------------------------
     * 3) SYNC PODS → CUSTOM TABLE (BOOKING)
     * ------------------------------------------------------- */
    public function sync_booking($pieces, $is_new, $post_id) {
        global $wpdb;

        $pod = pods('listing_booking', $post_id);
        if (!$pod || !$pod->id()) {
            // Fallback: try alternative Pod name
            $pod = pods('booking', $post_id);
            if (!$pod || !$pod->id()) return;
        }

        $table = $wpdb->prefix . 'touresm_bookings';

        // Handle related_listing - it's a relationship field, extract ID
        $related_listing = $this->get_pod_field($pod, 'related_listing');
        $related_listing_id = null;
        
        if (is_numeric($related_listing)) {
            $related_listing_id = (int)$related_listing;
        } elseif (is_array($related_listing) && !empty($related_listing)) {
            // Array of IDs or objects
            if (isset($related_listing[0])) {
                if (is_numeric($related_listing[0])) {
                    $related_listing_id = (int)$related_listing[0];
                } elseif (is_object($related_listing[0]) && isset($related_listing[0]->ID)) {
                    $related_listing_id = (int)$related_listing[0]->ID;
                }
            }
        } elseif (is_object($related_listing)) {
            if (isset($related_listing->ID)) {
                $related_listing_id = (int)$related_listing->ID;
            } elseif (isset($related_listing->id)) {
                $related_listing_id = (int)$related_listing->id;
            }
        }

        // If still no ID, skip this booking
        if (!$related_listing_id) {
            return;
        }

        // Format dates properly - convert to Y-m-d format
        $check_in = $this->get_pod_field($pod, 'check_in_date');
        $check_out = $this->get_pod_field($pod, 'check_out_date');
        $confirmation_date = $this->get_pod_field($pod, 'confirmation_date');
        
        // Helper function to normalize date
        $normalize_date = function($date) {
            if (empty($date)) return null;
            // If already in Y-m-d format, return as is
            if (preg_match('/^\d{4}-\d{2}-\d{2}/', $date)) {
                return substr($date, 0, 10);
            }
            // Try to parse and convert
            $timestamp = strtotime(str_replace('/', '-', $date));
            return $timestamp ? date('Y-m-d', $timestamp) : null;
        };
        
        $check_in_formatted = $normalize_date($check_in);
        $check_out_formatted = $normalize_date($check_out);
        
        // Format confirmation_date as datetime
        $confirmation_datetime = null;
        if (!empty($confirmation_date)) {
            $timestamp = strtotime(str_replace('/', '-', $confirmation_date));
            $confirmation_datetime = $timestamp ? date('Y-m-d H:i:s', $timestamp) : null;
        }

        $wpdb->replace($table, [
            'booking_post_id' => $post_id,
            'related_listing_post_id' => $related_listing_id,
            'customer_name' => $this->get_pod_field($pod, 'customer_name'),
            'customer_mobile' => $this->get_pod_field($pod, 'customer_mobile'),
            'check_in_date' => $check_in_formatted,
            'check_out_date' => $check_out_formatted,
            'guest_number' => $this->get_pod_int($pod, 'guest_number'),
            'booking_description' => $this->get_pod_field($pod, 'booking_description'),
            'paid_amount' => $this->get_pod_numeric($pod, 'paid_amount'),
            'paid_receipt' => $this->get_pod_field($pod, 'paid_receipt'),
            'confirmation_status' => $this->get_pod_field($pod, 'confirmation_status') ?: 'pending',
            'confirmation_date' => $confirmation_datetime,
        ], ['%d', '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%f', '%s', '%s', '%s']);
    }

    /* -------------------------------------------------------
     * 4) REST API (FULL)
     * ------------------------------------------------------- */
    public function api_routes() {

        register_rest_route('touresm/v1', '/listings', [
            'methods' => 'GET',
            'callback' => [$this, 'api_get_listings'],
            'permission_callback' => '__return_true'
        ]);

        register_rest_route('touresm/v1', '/listing/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [$this, 'api_get_listing_details'],
            'permission_callback' => '__return_true'
        ]);

        register_rest_route('touresm/v1', '/listing/(?P<id>\d+)/bookings', [
            'methods' => 'GET',
            'callback' => [$this, 'api_get_listing_bookings'],
            'permission_callback' => '__return_true'
        ]);

        register_rest_route('touresm/v1', '/booking', [
            'methods' => 'POST',
            'callback' => [$this, 'api_create_booking'],
            'permission_callback' => '__return_true'
        ]);

        // Bulk sync endpoints
        register_rest_route('touresm/v1', '/sync/listings', [
            'methods' => 'POST',
            'callback' => [$this, 'api_sync_listings'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        register_rest_route('touresm/v1', '/sync/bookings', [
            'methods' => 'POST',
            'callback' => [$this, 'api_sync_bookings'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);

        register_rest_route('touresm/v1', '/sync/all', [
            'methods' => 'POST',
            'callback' => [$this, 'api_sync_all'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ]);
    }

    /* -------- API Handlers ---------- */

    public function api_get_listings() {
        global $wpdb;
        return $wpdb->get_results("SELECT * FROM {$wpdb->prefix}touresm_listings", ARRAY_A);
    }

    public function api_get_listing_details($req) {
        global $wpdb;
        $id = (int)$req['id'];
        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$wpdb->prefix}touresm_listings WHERE listing_post_id = %d", $id),
            ARRAY_A
        );
    }

    public function api_get_listing_bookings($req) {
        global $wpdb;
        $id = (int)$req['id'];
        return $wpdb->get_results(
            $wpdb->prepare("SELECT * FROM {$wpdb->prefix}touresm_bookings WHERE related_listing_post_id = %d", $id),
            ARRAY_A
        );
    }

    public function api_create_booking($req) {
        global $wpdb;

        $data = [
            'related_listing_post_id' => $req['related_listing'],
            'customer_name' => $req['customer_name'],
            'customer_mobile' => $req['customer_mobile'],
            'check_in_date' => $req['check_in_date'],
            'check_out_date' => $req['check_out_date'],
            'guest_number' => $req['guest_number'],
            'booking_description' => $req['booking_description'],
            'paid_amount' => $req['paid_amount'],
            'paid_receipt' => $req['paid_receipt'],
            'confirmation_status' => 'pending'
        ];

        $wpdb->insert($wpdb->prefix.'touresm_bookings', $data);

        return [
            'success' => true,
            'booking_id' => $wpdb->insert_id
        ];
    }

    public function api_sync_listings($req) {
        $result = $this->bulk_sync_listings();
        return new WP_REST_Response([
            'success' => true,
            'synced' => $result['synced'],
            'failed' => $result['failed'],
            'total' => $result['total']
        ], 200);
    }

    public function api_sync_bookings($req) {
        $result = $this->bulk_sync_bookings();
        return new WP_REST_Response([
            'success' => true,
            'synced' => $result['synced'],
            'failed' => $result['failed'],
            'total' => $result['total']
        ], 200);
    }

    public function api_sync_all($req) {
        $listings_result = $this->bulk_sync_listings();
        $bookings_result = $this->bulk_sync_bookings();
        return new WP_REST_Response([
            'success' => true,
            'listings' => [
                'synced' => $listings_result['synced'],
                'failed' => $listings_result['failed'],
                'total' => $listings_result['total']
            ],
            'bookings' => [
                'synced' => $bookings_result['synced'],
                'failed' => $bookings_result['failed'],
                'total' => $bookings_result['total']
            ]
        ], 200);
    }

    /* -------------------------------------------------------
     * 5) BULK SYNC FUNCTIONS
     * ------------------------------------------------------- */

    /**
     * Sync all existing listings to custom table
     */
    public function bulk_sync_listings($limit = null, $offset = 0) {
        $args = [
            'post_type' => 'listing',
            'post_status' => 'publish',
            'posts_per_page' => $limit ?: -1,
            'offset' => $offset,
            'fields' => 'ids'
        ];

        $query = new WP_Query($args);
        $synced = 0;
        $failed = 0;

        foreach ($query->posts as $post_id) {
            try {
                $this->sync_listing([], false, $post_id);
                $synced++;
            } catch (Exception $e) {
                $failed++;
                error_log("Failed to sync listing {$post_id}: " . $e->getMessage());
            }
        }

        wp_reset_postdata();

        return [
            'synced' => $synced,
            'failed' => $failed,
            'total' => $synced + $failed
        ];
    }

    /**
     * Sync all existing bookings to custom table
     */
    public function bulk_sync_bookings($limit = null, $offset = 0) {
        $args = [
            'post_type' => 'listing_booking',
            'post_status' => 'any',
            'posts_per_page' => $limit ?: -1,
            'offset' => $offset,
            'fields' => 'ids'
        ];

        $query = new WP_Query($args);
        $synced = 0;
        $failed = 0;

        foreach ($query->posts as $post_id) {
            try {
                $this->sync_booking([], false, $post_id);
                $synced++;
            } catch (Exception $e) {
                $failed++;
                error_log("Failed to sync booking {$post_id}: " . $e->getMessage());
            }
        }

        wp_reset_postdata();

        return [
            'synced' => $synced,
            'failed' => $failed,
            'total' => $synced + $failed
        ];
    }

    /**
     * Admin menu for bulk sync
     */
    public function add_admin_menu() {
        add_management_page(
            'Touresm DB Sync',
            'Touresm DB Sync',
            'manage_options',
            'touresm-db-sync',
            [$this, 'admin_sync_page']
        );
    }

    /**
     * Admin page for triggering bulk sync
     */
    public function admin_sync_page() {
        if (isset($_POST['sync_listings']) && check_admin_referer('touresm_sync')) {
            $result = $this->bulk_sync_listings();
            echo '<div class="notice notice-success"><p>';
            echo sprintf('Synced %d listings. Failed: %d', $result['synced'], $result['failed']);
            echo '</p></div>';
        }

        if (isset($_POST['sync_bookings']) && check_admin_referer('touresm_sync')) {
            $result = $this->bulk_sync_bookings();
            echo '<div class="notice notice-success"><p>';
            echo sprintf('Synced %d bookings. Failed: %d', $result['synced'], $result['failed']);
            echo '</p></div>';
        }

        if (isset($_POST['sync_all']) && check_admin_referer('touresm_sync')) {
            $listings_result = $this->bulk_sync_listings();
            $bookings_result = $this->bulk_sync_bookings();
            echo '<div class="notice notice-success"><p>';
            echo sprintf('Listings: %d synced, %d failed. Bookings: %d synced, %d failed.',
                $listings_result['synced'], $listings_result['failed'],
                $bookings_result['synced'], $bookings_result['failed']
            );
            echo '</p></div>';
        }

        ?>
        <div class="wrap">
            <h1>Touresm DB Sync</h1>
            <p>Sync existing listings and bookings from Pods to custom database tables.</p>
            
            <form method="post" action="">
                <?php wp_nonce_field('touresm_sync'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">Sync Listings</th>
                        <td>
                            <button type="submit" name="sync_listings" class="button button-primary">
                                Sync All Listings
                            </button>
                            <p class="description">Sync all existing listings to the custom table.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Sync Bookings</th>
                        <td>
                            <button type="submit" name="sync_bookings" class="button button-primary">
                                Sync All Bookings
                            </button>
                            <p class="description">Sync all existing bookings to the custom table.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Sync All</th>
                        <td>
                            <button type="submit" name="sync_all" class="button button-primary">
                                Sync Everything
                            </button>
                            <p class="description">Sync both listings and bookings.</p>
                        </td>
                    </tr>
                </table>
            </form>

            <hr>

            <h2>Alternative Methods</h2>
            <h3>Via REST API:</h3>
            <p>POST to: <code><?php echo rest_url('touresm/v1/sync/listings'); ?></code></p>
            <p>POST to: <code><?php echo rest_url('touresm/v1/sync/bookings'); ?></code></p>
            <p>POST to: <code><?php echo rest_url('touresm/v1/sync/all'); ?></code></p>

            <h3>Via WP-CLI:</h3>
            <pre>wp touresm sync-listings
wp touresm sync-bookings
wp touresm sync-all</pre>
        </div>
        <?php
    }

    /**
     * WP-CLI command: Sync listings
     */
    public function wpcli_sync_listings($args, $assoc_args) {
        if (!class_exists('WP_CLI')) return;

        \WP_CLI::line('Syncing listings...');
        $result = $this->bulk_sync_listings();
        \WP_CLI::success(sprintf('Synced %d listings. Failed: %d', $result['synced'], $result['failed']));
    }

    /**
     * WP-CLI command: Sync bookings
     */
    public function wpcli_sync_bookings($args, $assoc_args) {
        if (!class_exists('WP_CLI')) return;

        \WP_CLI::line('Syncing bookings...');
        $result = $this->bulk_sync_bookings();
        \WP_CLI::success(sprintf('Synced %d bookings. Failed: %d', $result['synced'], $result['failed']));
    }

    /**
     * WP-CLI command: Sync all
     */
    public function wpcli_sync_all($args, $assoc_args) {
        if (!class_exists('WP_CLI')) return;

        \WP_CLI::line('Syncing all data...');
        $listings_result = $this->bulk_sync_listings();
        $bookings_result = $this->bulk_sync_bookings();
        \WP_CLI::success(sprintf(
            'Listings: %d synced, %d failed. Bookings: %d synced, %d failed.',
            $listings_result['synced'], $listings_result['failed'],
            $bookings_result['synced'], $bookings_result['failed']
        ));
    }
}

new Touresm_DB_Layer();