<?php
/*
Plugin Name: Touresm House Management
Description: Manage houses with title, description, and available dates.
Version: 3.1
Author: SimpleSmart
*/

// === Custom Post Type: House ===
require_once plugin_dir_path(__FILE__) . 'includes/house-date-range-view.php';
require_once plugin_dir_path(__FILE__) . 'includes/house-management-frontend-confirmation.php';
include_once plugin_dir_path(__FILE__) . 'includes/booking-list.php';

// === Custom Rewrite Rules for Short URLs ===
function add_house_rewrite_rules() {
    add_rewrite_rule(
        '^h/([0-9]+)/?$',
        'index.php?house_short_id=$matches[1]',
        'top'
    );
}
add_action('init', 'add_house_rewrite_rules');

function add_house_query_vars($vars) {
    $vars[] = 'house_short_id';
    return $vars;
}
add_action('query_vars', 'add_house_query_vars');

function handle_house_short_url() {
    $house_id = get_query_var('house_short_id');
    
    if (!empty($house_id)) {
        // Redirect to the booking confirmation page with the house_id
        $booking_url = home_url('/house-booking-confirmation/') . '?house_id=' . intval($house_id);
        wp_redirect($booking_url, 301);
        exit;
    }
}
add_action('template_redirect', 'handle_house_short_url');

// Flush rewrite rules on plugin activation
function flush_house_rewrite_rules() {
    add_house_rewrite_rules();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'flush_house_rewrite_rules');

// Manual flush function for immediate activation
function manual_flush_house_rewrite_rules() {
    add_house_rewrite_rules();
    flush_rewrite_rules();
}

function house_management_register_post_type() {
    register_post_type('house', [
        'labels' => [
            'name' => 'Houses',
            'singular_name' => 'House',
        ],
        'public' => true,
        'has_archive' => true,
        'supports' => ['title', 'editor', 'thumbnail'],
    ]);
}
add_action('init', 'house_management_register_post_type');

function enqueue_flatpickr_assets($hook) {
    if ('post.php' !== $hook && 'post-new.php' !== $hook) {
        return;
    }
    wp_enqueue_script('flatpickr-js', 'https://cdn.jsdelivr.net/npm/flatpickr', [], null, true);
    wp_enqueue_style('flatpickr-css', 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css');
}
add_action('admin_enqueue_scripts', 'enqueue_flatpickr_assets');

function enqueue_lordicon_script() {
    wp_enqueue_script('lordicon', 'https://cdn.lordicon.com/lordicon.js', array(), null, true);
}
add_action('wp_enqueue_scripts', 'enqueue_lordicon_script');

function enqueue_flatpickr_assets_frontend() {
    wp_enqueue_script('jquery');
    wp_enqueue_script('jquery-ui-dialog');
    wp_enqueue_style('jquery-ui-css', 'https://code.jquery.com/ui/1.13.2/themes/smoothness/jquery-ui.css');
    wp_enqueue_script('flatpickr-js', 'https://cdn.jsdelivr.net/npm/flatpickr', [], null, true);
    wp_enqueue_style('flatpickr-css', 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css');
}
add_action('wp_enqueue_scripts', 'enqueue_flatpickr_assets_frontend');

function enqueue_fontawesome_cdn() {
    wp_enqueue_style(
        'font-awesome',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
        array(),
        '6.5.0'
    );
}
add_action('wp_enqueue_scripts', 'enqueue_fontawesome_cdn');

// === Meta Box for Available Dates ===
function add_available_dates_metabox() {
    add_meta_box(
        'available_dates_metabox',
        'Available Dates',
        'available_dates_metabox_callback',
        'house',
        'side',
        'default'
    );
}
add_action('add_meta_boxes', 'add_available_dates_metabox');

function add_house_size_metabox() {
    add_meta_box(
        'house_size_metabox',
        'House Size',
        'house_size_metabox_callback',
        'house',
        'side',
        'default'
    );
}
add_action('add_meta_boxes', 'add_house_size_metabox');

function house_size_metabox_callback($post) {
    $house_size = get_post_meta($post->ID, 'house_size', true);
    ?>
    <label for="house_size">Select House Size:</label>
    <select id="house_size" name="house_size" style="width: 100%;">
        <option value="" <?php selected($house_size, ''); ?>>-- Select Size --</option>
        <option value="Large" <?php selected($house_size, 'Large'); ?>>Large</option>
        <option value="Medium" <?php selected($house_size, 'Medium'); ?>>Medium</option>
        <option value="Small" <?php selected($house_size, 'Small'); ?>>Small</option>
    </select>
    <?php
}

function save_house_size_meta($post_id) {
    if (get_post_type($post_id) === 'house' && isset($_POST['house_size'])) {
        $house_size = sanitize_text_field($_POST['house_size']);
        update_post_meta($post_id, 'house_size', $house_size);
    }
}
add_action('save_post', 'save_house_size_meta');

function available_dates_metabox_callback($post) {
    $available_dates = get_post_meta($post->ID, 'available_dates', true);
    echo '<label for="available_dates">Select available dates:</label>';
    echo '<input id="available_dates" name="available_dates" type="text" style="width: 100%;" value="' . esc_attr($available_dates) . '">';
    echo '<p>Hold Ctrl/Cmd to select multiple dates.</p>';
    echo '<script>
        document.addEventListener("DOMContentLoaded", function() {
            flatpickr("#available_dates", {
                mode: "multiple",
                dateFormat: "Y-m-d"
            });
        });
    </script>';
}

function save_available_dates_meta($post_id) {
    if (get_post_type($post_id) === 'house' && isset($_POST['available_dates'])) {
        $available_dates = sanitize_text_field($_POST['available_dates']);
        update_post_meta($post_id, 'available_dates', $available_dates);
    }
    if (get_post_type($post_id) === 'house' && isset($_POST['owner_available_dates'])) {
        $available_dates = sanitize_text_field($_POST['owner_available_dates']);
        update_post_meta($post_id, 'owner_available_dates', $available_dates);
    }
}
add_action('save_post', 'save_available_dates_meta');

function display_houses_table_calendar_shortcode($atts) {
    
    $month = date('Y-m');
    if (isset($_GET['month'])) {
        $month = date('Y-m', strtotime($_GET['month']));
    }

    $house_search = isset($_GET['house_search']) ? sanitize_text_field($_GET['house_search']) : '';

    // Query all houses and their available dates
    $args = [
        'post_type' => 'house',
        'posts_per_page' => -1,
        'post_status' => 'publish',
    ];

    if (!empty($house_search)) {
        $args['s'] = $house_search;
    }

    $query = new WP_Query($args);

    // Prepare house data
    $houses = [];
if ($query->have_posts()) {
    while ($query->have_posts()) {
        $query->the_post();
        $post_id = get_the_ID();
        $title = get_the_title();
        $available_dates = get_post_meta($post_id, 'available_dates', true);
        $owner_available_dates = get_post_meta($post_id, 'owner_available_dates', true);
        $house_size = get_post_meta($post_id, 'house_size', true);

        // Огноо хоосон бол хоосон массив хадгална
        $dates = !empty($available_dates) ? array_map('trim', explode(',', $available_dates)) : [];
        $owner_dates = !empty($owner_available_dates) ? array_map('trim', explode(',', $owner_available_dates)) : [];

        $houses[] = [
            'id' => $post_id,
            'title' => $title,
            'dates' => $dates,
            'owner_dates' => $owner_dates,
            'size' => $house_size
        ];
    }
    wp_reset_postdata();
}

    // Get days of the selected month
    $first_day_of_month = $month . '-01';
    $days_in_month = date('t', strtotime($first_day_of_month));
    $month_name = date('F Y', strtotime($first_day_of_month));

    ob_start();
    ?>
    <div class="houses-calendar-container">
        <div class="calendar-header">
            <form id="calendar-form" method="GET" class="calendar-filters">
                <div class="filter-group">
                    <label for="month-select">Огноо сонгох:</label>
                    <select id="month-select" name="month" onchange="this.form.submit()" class="modern-select">
                        <?php
                        // Show the previous month
                        $previous_month = date('Y-m', strtotime('-1 month', strtotime($month . '-01')));
                        $previous_label = date('F Y', strtotime('-1 month', strtotime($month . '-01')));
                        echo "<option value='" . esc_attr($previous_month) . "'>" . esc_html($previous_label) . "</option>";

                        // Show the current month and next 11 months
                        for ($i = 0; $i < 11; $i++) {
                            $month_option = date('Y-m', strtotime("+$i months", strtotime($month . '-01')));
                            $month_label = date('F Y', strtotime("+$i months", strtotime($month . '-01')));
                            $selected = ($month_option === $month) ? 'selected' : '';
                            echo "<option value='" . esc_attr($month_option) . "' $selected>$month_label</option>";
                        }
                        ?>
                    </select>
                </div>

                <div class="filter-group">
                    <label for="house_search">Хаус хайх:</label>
                    <input type="text" id="house_search" name="house_search" value="<?php echo esc_attr($house_search); ?>" 
                           placeholder="Хаусны нэр оруулах" oninput="this.form.submit();" class="modern-input">
                </div>
            </form>

            <div class="calendar-legend">
                <div class="legend-item">
                    <span class="legend-color available"></span>
                    <span class="legend-text">Available</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color owner"></span>
                    <span class="legend-text">Host</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color selected"></span>
                    <span class="legend-text">Admin</span>
                </div>
            </div>
        </div>

        <h3 class="calendar-title"><?php echo esc_html($month_name); ?></h3>
        
        <div class="calendar-table-wrapper">
            <table class="houses-calendar">
                <thead>
                    <tr>
                        <th class="house-name-col">Хаус нэр</th>
                        <?php for ($day = 1; $day <= $days_in_month; $day++): ?>
                            <th class="date-col">
                                <?php
                                $current_date = $month . '-' . str_pad($day, 2, '0', STR_PAD_LEFT);
                                $day_of_week = date('D', strtotime($current_date));
                                echo '<div class="date-header">';
                                echo '<span class="date-number">' . $day . '</span>';
                                echo '<span class="date-day">' . $day_of_week . '</span>';
                                echo '</div>';
                                ?>
                            </th>
                        <?php endfor; ?>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($houses as $house): ?>
                        <tr data-id="<?php echo esc_attr($house['id']); ?>">
                            <th class="house-name-col">
                                <a href="https://touresm.cloud/house-form/?edit_house_id=<?php echo esc_attr($house['id']); ?>" 
                                   target="_blank" class="house-link">
                                    <?php echo esc_html($house['title']); ?>
                                </a>
                                <div class="house-size-label <?php echo strtolower($house['size']); ?>">
                                    <?php echo $house['size']; ?>
                                </div>
                            </th>
                            <?php for ($day = 1; $day <= $days_in_month; $day++): ?>
                                <?php
                                $current_date = $month . '-' . str_pad($day, 2, '0', STR_PAD_LEFT);
                                $is_available = in_array($current_date, $house['dates']);
                                
                                $owner_class = '';
                                if (in_array($current_date, $house['owner_dates'])) {
                                    $owner_class = ' owner';
                                }
                                ?>
                                <td class="date-cell <?php echo $is_available ? 'available' : ''; echo $owner_class; ?>">
                                    <span class="date-indicator" 
                                          data-id="<?php echo esc_attr($house['id']); ?>" 
                                          data-date="<?php echo esc_attr($current_date); ?>"
                                          data-action="<?php echo $is_available ? 'remove' : 'add'; ?>">
                                        <?php echo $is_available ? '✓' : '×'; ?>
                                    </span>
                                </td>
                            <?php endfor; ?>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <style>
    .houses-calendar-container {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 20px;
        margin: 20px 0;
    }

    .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 20px;
    }

    .calendar-filters {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .modern-select, .modern-input {
        padding: 8px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        font-size: 14px;
        transition: all 0.3s ease;
        background: #f8f9fa;
    }

    .modern-select:focus, .modern-input:focus {
        border-color: #a7c957;
        box-shadow: 0 0 0 2px rgba(167, 201, 87, 0.2);
        outline: none;
    }

    .calendar-legend {
        display: flex;
        gap: 15px;
        align-items: center;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .legend-color {
        width: 16px;
        height: 16px;
        border-radius: 4px;
    }

    .legend-color.available {
        background-color: #dde5b6;
    }

    .legend-color.owner {
        background-color: #c1121f;
    }

    .legend-color.selected {
        background-color: #e9ecef;
    }

    .calendar-title {
        font-size: 24px;
        color: #333;
        margin: 20px 0;
        text-align: center;
    }

    .calendar-table-wrapper {
        overflow-x: auto;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        position: relative;
        max-height: 80vh;
        overflow-y: auto;
    }

    .houses-calendar {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: #fff;
        user-select: none;
    }

    .houses-calendar thead {
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .houses-calendar thead th {
        background: #f8f9fa;
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 2px solid #e0e0e0;
    }

    .house-name-col {
        position: sticky;
        left: 0;
        background: #fff;
        z-index: 5;
        min-width: 100px;
        text-align: left !important;
    }

    .houses-calendar thead .house-name-col {
        z-index: 15;
        background: #f8f9fa;
    }

    .date-col {
        min-width: 60px;
    }

    .date-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .date-number {
        font-weight: bold;
        color: #333;
    }

    .date-day {
        font-size: 12px;
        color: #666;
    }

    .house-link {
        display:block;
        color: #333;
        text-decoration: none !important;
        font-weight: 500;
        transition: color 0.3s ease;
    }

    .house-link:hover {
        color: #a7c957;
    }

    .house-size-label {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        margin-top: 5px;
        background-color: #f8f9fa;
    }

    .date-cell {
        position: relative;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .date-cell:hover {
        background-color: #f8f9fa;
    }

    .date-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding-bottom:2px;
        border-radius: 50%;
        margin: 0 auto;
        transition: all 0.3s ease;
    }

    .date-cell.available .date-indicator {
        background-color: #dde5b6;
        color: #386641;
    }

    .date-cell.owner .date-indicator {
        background-color: #c1121f;
        color: #fff;
    }

    .date-cell:not(.available):not(.owner) .date-indicator {
        background-color: #e9ecef;
        color: #495057;
    }

    .date-cell.selected {
        background-color: #a7c957 !important;
    }

    .date-cell.selected .date-indicator {
        background-color: #fff;
        color: #386641;
    }

    @media (max-width: 768px) {
        .calendar-header {
            flex-direction: column;
            align-items: stretch;
        }

        .calendar-filters {
            flex-direction: column;
        }

        .calendar-legend {
            justify-content: center;
        }

        .house-name-col {
            min-width: 150px;
        }

        .date-col {
            min-width: 50px;
        }
    }
    </style>

    <div id="dialog-confirm" title="Админ уу? Owner уу?" style="display: none;">
        <p><span class="ui-icon ui-icon-alert" style="float:left; margin:12px 12px 20px 0;"></span>Сонгоно уу.</p>
    </div>

    <style>
    /* Add back dialog styles */
    .ui-icon.ui-icon-alert {
        display: none;
    }
    
    .ui-dialog-titlebar.ui-widget-header {
        background: none;
        border: none;
        box-shadow: none;
    }
    
    .ui-dialog-buttonpane.ui-widget-content {
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .ui-dialog-content.ui-widget-content p {
        margin: 0;
    }
    
    .ui-button.ui-corner-all.ui-widget.ui-dialog-titlebar-close {
        background: none;    
    }
    
    .ui-button.ui-corner-all.ui-widget {
        border: none;
        background: #dde5b6;
        box-shadow: none;
        color: #fff;
    }
    
    .ui-button.ui-corner-all.ui-widget:last-child:not(.ui-dialog-titlebar-close) {
        border: none;
        background: #c1121f;
        box-shadow: none;
    }
    </style>

    <script>
    document.addEventListener('DOMContentLoaded', function () {
        const updateCalendarCell = (houseId, dates, action, isAdmin) => {
            dates.forEach(date => {
                const button = document.querySelector(`span[data-id="${houseId}"][data-date="${date}"]`);
                if (button) {
                    const cell = button.parentElement;
                    const newButton = document.createElement('span');
                    newButton.className = 'date-indicator';
                    
                    if (action === 'add') {
                        cell.innerHTML = '';
                        newButton.textContent = '✓';
                        newButton.setAttribute('data-id', button.getAttribute('data-id'));
                        newButton.setAttribute('data-date', button.getAttribute('data-date'));
                        newButton.setAttribute('data-action', 'remove');
                        cell.classList.add('available');
                        cell.classList.remove('owner');
                        cell.classList.remove('selected');
                        cell.appendChild(newButton);
                    } else if (action === 'remove') {
                        cell.classList.remove('available');
                        cell.classList.remove('owner');
                        cell.classList.remove('selected');
                        cell.innerHTML = '';
                        newButton.textContent = '×';
                        newButton.setAttribute('data-id', button.getAttribute('data-id'));
                        newButton.setAttribute('data-date', button.getAttribute('data-date'));
                        newButton.setAttribute('data-action', 'add');
                        if(isAdmin === 'owner') {
                            cell.classList.add('owner');
                        }
                        cell.appendChild(newButton);
                    }
                }
            });
        };

        let isDragging = false;
        let startRow = null;
        let selectedHouseId = null;
        let selectedAction = null; 
        let selectedDates = new Set();

        document.addEventListener("mousedown", function(event) {
            document.querySelectorAll('td.selected').forEach(el => el.classList.remove('selected'));

            if (event.target.tagName === "TD" && event.target.cellIndex !== 0) {
                isDragging = true;
                startRow = event.target.parentElement;
                const span = event.target.querySelector("span");
                if (span) {
                    selectedHouseId = span.getAttribute("data-id");
                    selectedAction = span.getAttribute("data-action");
                    toggleSelection(event.target);
                }
            }
        });

        document.addEventListener("mouseover", function(event) {
            if (isDragging && event.target.tagName === "TD" && event.target.cellIndex !== 0) {
                if (event.target.parentElement === startRow) {
                    const span = event.target.querySelector("span");
                    if (span && span.getAttribute("data-action") === selectedAction) {
                        toggleSelection(event.target);
                    } else {
                        isDragging = false;
                        startRow = null;
                        sendSelectedCellsToAPI();
                    }
                }
            }
        });

        document.addEventListener("mouseup", function() {
            if (isDragging) {
                isDragging = false;
                startRow = null;
                sendSelectedCellsToAPI();
            }
        });

        function toggleSelection(cell) {
            cell.classList.toggle("selected");
            const span = cell.querySelector("span");
            if (span) {
                selectedDates.add(span.dataset.date);
            }
        }
        
        function sendSelectedCellsToAPI() {
            if (selectedDates.size > 0) {
                const selectedData = Array.from(selectedDates);
                
                if(selectedAction === "add") {
                    fetch('<?php echo esc_url(rest_url('house/v1/update-date')); ?>', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            house_id: selectedHouseId,
                            dates: selectedData,
                            isOwner: true
                        }),
                    })
                    .then(response => response.json())
                    .then(data => {
                        updateCalendarCell(selectedHouseId, selectedDates, 'add', '')
                        selectedDates.clear();
                    });
                } else {
                    jQuery("#dialog-confirm").dialog({
                        modal: true,
                        buttons: {
                            Admin: function() {
                                fetch('<?php echo esc_url(rest_url('house/v1/remove-date')); ?>', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        house_id: selectedHouseId,
                                        dates: selectedData,
                                        isOwner: false
                                    }),
                                })
                                .then(response => response.json())
                                .then(data => {
                                    updateCalendarCell(selectedHouseId, selectedDates, 'remove', 'admin')
                                    selectedDates.clear();
                                });
                                jQuery(this).dialog("close");
                            },
                            Owner: function() {
                                fetch('<?php echo esc_url(rest_url('house/v1/remove-date')); ?>', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        house_id: selectedHouseId,
                                        dates: selectedData,
                                        isOwner: true
                                    }),
                                })
                                .then(response => response.json())
                                .then(data => {
                                    updateCalendarCell(selectedHouseId, selectedDates, 'remove', 'owner')
                                    selectedDates.clear();
                                });
                                jQuery(this).dialog("close");
                            }
                        }
                    });
                }
            }
        }

        // Force plain text paste in description field
        var descField = document.getElementById('house_description');
        if (descField) {
            descField.addEventListener('paste', function(e) {
                e.preventDefault();
                var text = '';
                if (e.clipboardData && e.clipboardData.getData) {
                    text = e.clipboardData.getData('text/plain');
                } else if (window.clipboardData && window.clipboardData.getData) {
                    text = window.clipboardData.getData('Text');
                }
                // Insert plain text at cursor position
                var start = descField.selectionStart;
                var end = descField.selectionEnd;
                var value = descField.value;
                descField.value = value.substring(0, start) + text + value.substring(end);
                // Move cursor to end of pasted text
                descField.selectionStart = descField.selectionEnd = start + text.length;
            });
        }

        var form = document.querySelector('.house-management-form');
        var isDirty = false;
        var beforeUnloadHandler = function(e) {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave without saving?';
                return 'You have unsaved changes. Are you sure you want to leave without saving?';
            }
        };
        form.addEventListener('input', function() { isDirty = true; });
        form.addEventListener('change', function() { isDirty = true; });
        window.addEventListener('beforeunload', beforeUnloadHandler);
        var cancelBtn = document.getElementById('cancel-button');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function(e) {
                e.preventDefault(); // Always prevent default
                if (isDirty) {
                    var confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave without saving?');
                    if (confirmLeave) {
                        window.removeEventListener('beforeunload', beforeUnloadHandler);
                        window.location.href = window.location.origin + window.location.pathname;
                    }
                    // If not confirmed, do nothing (stay on page)
                } else {
                    window.removeEventListener('beforeunload', beforeUnloadHandler);
                    window.location.href = window.location.origin + window.location.pathname;
                }
            });
        }
        form.addEventListener('submit', function() {
            isDirty = false;
            window.removeEventListener('beforeunload', beforeUnloadHandler);
        });
    });
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('houses_table_calendar', 'display_houses_table_calendar_shortcode');

function update_house_date(WP_REST_Request $request) {
    $house_id = $request->get_param('house_id');
    $dates = $request->get_param('dates');
    $is_owner = $request->get_param('isOwner');

    if (empty($house_id) || empty($dates)) {
        return new WP_REST_Response(['success' => false, 'message' => 'Invalid parameters'], 400);
    }

    // Post meta-г авах
    $owner_current_dates = get_post_meta($house_id, 'owner_available_dates', true);
    $owner_current_dates = !empty($owner_current_dates) ? explode(',', $owner_current_dates) : [];
    $current_dates = get_post_meta($house_id, 'available_dates', true);
    $current_dates = !empty($current_dates) ? explode(',', $current_dates) : [];
    
    // Add эсвэл Remove үйлдэл
    foreach ($dates as $date) {
        if (in_array($date, $current_dates)) {
            // Remove date
            $current_dates = array_filter($current_dates, fn($d) => $d !== $date);
        } else {
            // Add date
            $current_dates[] = $date;
            $owner_current_dates = array_filter($owner_current_dates, fn($d) => $d !== $date);
        }
    }

    // Post meta-г шинэчлэх
    update_post_meta($house_id, 'available_dates', implode(',', $current_dates));
    if($is_owner) {
        update_post_meta($house_id, 'owner_available_dates', implode(',', $owner_current_dates));
    }
    

    // Response буцаах
    return new WP_REST_Response(['success' => true], 200);
}


function remove_house_date(WP_REST_Request $request) {
    $house_id = $request->get_param('house_id');
    $dates = $request->get_param('dates');
    $is_owner = $request->get_param('isOwner');

    if (empty($house_id) || empty($dates)) {
        return new WP_REST_Response(['success' => false, 'message' => 'Invalid parameters'], 400);
    }

    // Post meta-г авах
    $owner_current_dates = get_post_meta($house_id, 'owner_available_dates', true);
    $owner_current_dates = !empty($owner_current_dates) ? explode(',', $owner_current_dates) : [];
    $current_dates = get_post_meta($house_id, 'available_dates', true);
    $current_dates = !empty($current_dates) ? explode(',', $current_dates) : [];

    // Add эсвэл Remove үйлдэл
    foreach ($dates as $date) {
        if (in_array($date, $current_dates)) {
            // Remove date
            $current_dates = array_filter($current_dates, fn($d) => $d !== $date);
        }
        if($is_owner) {
            if (!in_array($date, $owner_current_dates)) {
                // Add date
                $owner_current_dates[] = $date;
            }
        }
    }

    // Post meta-г шинэчлэх
    update_post_meta($house_id, 'available_dates', implode(',', $current_dates));
    update_post_meta($house_id, 'owner_available_dates', implode(',', $owner_current_dates));

    // Response буцаах
    return new WP_REST_Response(['success' => true], 200);
}

add_action('rest_api_init', function () {
    register_rest_route('house/v1', '/update-date', [
        'methods' => 'POST',
        'callback' => 'update_house_date',
        'permission_callback' => '__return_true',
    ]);
});

add_action('rest_api_init', function () {
    register_rest_route('house/v1', '/remove-date', [
        'methods' => 'POST',
        'callback' => 'remove_house_date',
        'permission_callback' => '__return_true',
    ]);
});

function edit_house(WP_REST_Request $request) {
    $post_id = $request->get_param('house_id');
    $title = sanitize_text_field($request->get_param('house_title'));
    $size = sanitize_text_field($request->get_param('house_size'));
    $dates = sanitize_text_field($request->get_param('available_dates'));
    $house_url = sanitize_text_field($request->get_param('house_url'));
    $video_url = sanitize_text_field($request->get_param('video_url'));

    if (get_post_type($post_id) === 'house') {
        wp_update_post([
            'ID' => $post_id,
            'post_title' => $title,
            'post_status' => 'publish' // Ensure the post is public
        ]);

        update_post_meta($post_id, 'house_size', $size);
        update_post_meta($post_id, 'available_dates', $dates);
        update_post_meta($post_id, 'house_url', esc_url_raw($house_url));
        update_post_meta($post_id, 'video_url', esc_url_raw($video_url));

        // Handle featured image upload
        if (isset($_FILES['house_featured_image']) && $_FILES['house_featured_image']['error'] === 0) {
            require_once(ABSPATH . 'wp-admin/includes/image.php');
            require_once(ABSPATH . 'wp-admin/includes/file.php');
            require_once(ABSPATH . 'wp-admin/includes/media.php');
            $attachment_id = media_handle_upload('house_featured_image', $post_id);
            if (!is_wp_error($attachment_id)) {
                set_post_thumbnail($post_id, $attachment_id);
            }
        }

        // Handle gallery images
        if (isset($_POST['gallery_preview_ids'])) {
            $preview_image_ids = array_map('intval', explode(',', $_POST['gallery_preview_ids']));
            
            // Get existing gallery images
            $existing_gallery_ids = get_post_meta($post_id, 'house_gallery', true);
            if (!is_array($existing_gallery_ids)) {
                $existing_gallery_ids = array();
            }
            
            // Delete images that are not in the preview
            foreach ($existing_gallery_ids as $existing_id) {
                if (!in_array($existing_id, $preview_image_ids)) {
                    wp_delete_attachment($existing_id, true);
                }
            }
            
            // Update gallery meta with remaining images
            if (!empty($preview_image_ids)) {
                update_post_meta($post_id, 'house_gallery', $preview_image_ids);
            } else {
                delete_post_meta($post_id, 'house_gallery');
            }
        }

        return new WP_REST_Response(['message' => 'House updated successfully.'], 200);
    }

    return new WP_REST_Response(['message' => 'Invalid house ID.'], 400);
}

add_action('rest_api_init', function () {
    register_rest_route('house/v1', '/edit', [
        'methods' => 'POST',
        'callback' => 'edit_house',
        'permission_callback' => '__return_true', // Make the endpoint public
    ]);
});


// === Shortcode: Front-End Form for Adding House ===
function house_management_frontend_form_with_list_shortcode() {
    
    $message = ''; // Амжилттай эсвэл алдаа мессеж хадгалах
    $edit_house_id = isset($_GET['edit_house_id']) ? absint($_GET['edit_house_id']) : 0;

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['house_management_nonce'])) {
        // Nonce шалгах
        if (!wp_verify_nonce($_POST['house_management_nonce'], 'house_management_form')) {
            $message = '<p>Security check failed!</p>';
        } else {
            // Санал болгож буй өгөгдлийг хадгалах
            $title = sanitize_text_field($_POST['house_title']);
            $description = wp_kses_post($_POST['house_description']);
            $available_dates = sanitize_text_field($_POST['available_dates']);
            $house_size = sanitize_text_field($_POST['house_size']);
            $featured_image_id = isset($_POST['house_featured_image_id']) ? absint($_POST['house_featured_image_id']) : 0;
            $house_url = isset($_POST['house_url']) ? esc_url_raw($_POST['house_url']) : '';
            $video_url = isset($_POST['video_url']) ? esc_url_raw($_POST['video_url']) : '';

            if ($edit_house_id) {
                // Засвар хийх
                wp_update_post([
                    'ID' => $edit_house_id,
                    'post_title' => $title,
                    'post_content' => $description,
                ]);

                update_post_meta($edit_house_id, 'house_size', $house_size);
                update_post_meta($edit_house_id, 'house_url', $house_url);
                update_post_meta($edit_house_id, 'video_url', $video_url);

                // Handle featured image upload
                if (isset($_FILES['house_featured_image']) && $_FILES['house_featured_image']['error'] === 0) {
                    require_once(ABSPATH . 'wp-admin/includes/image.php');
                    require_once(ABSPATH . 'wp-admin/includes/file.php');
                    require_once(ABSPATH . 'wp-admin/includes/media.php');
                    $attachment_id = media_handle_upload('house_featured_image', $edit_house_id);
                    if (!is_wp_error($attachment_id)) {
                        set_post_thumbnail($edit_house_id, $attachment_id);
                    }
                } elseif ($featured_image_id) {
                    set_post_thumbnail($edit_house_id, $featured_image_id);
                }

                // Handle gallery images
                if (isset($_FILES['house_gallery'])) {
                    require_once(ABSPATH . 'wp-admin/includes/image.php');
                    require_once(ABSPATH . 'wp-admin/includes/file.php');
                    require_once(ABSPATH . 'wp-admin/includes/media.php');
                    
                    // Get existing gallery images
                    $existing_gallery_ids = get_post_meta($edit_house_id, 'house_gallery', true);
                    if (!is_array($existing_gallery_ids)) {
                        $existing_gallery_ids = array();
                    }
                    
                    // Get preview image IDs
                    $preview_image_ids = array();
                    if (isset($_POST['gallery_preview_ids'])) {
                        $preview_image_ids = array_map('intval', explode(',', $_POST['gallery_preview_ids']));
                    }
                    
                    // Delete existing gallery images that are not in the preview
                    foreach ($existing_gallery_ids as $existing_id) {
                        if (!in_array($existing_id, $preview_image_ids)) {
                            wp_delete_attachment($existing_id, true);
                        }
                    }
                    
                    // Start with existing images that are still in preview
                    $gallery_ids = $preview_image_ids;
                    
                    // Handle new file uploads
                    $files = $_FILES['house_gallery'];
                    if (!empty($files['name'][0])) {  // Check if any files were uploaded
                        // Handle multiple file uploads
                        for ($i = 0; $i < count($files['name']); $i++) {
                            if ($files['error'][$i] === 0) {
                                $file = array(
                                    'name'     => $files['name'][$i],
                                    'type'     => $files['type'][$i],
                                    'tmp_name' => $files['tmp_name'][$i],
                                    'error'    => $files['error'][$i],
                                    'size'     => $files['size'][$i]
                                );
                                
                                $_FILES['gallery_file'] = $file;
                                $attachment_id = media_handle_upload('gallery_file', $edit_house_id);
                                
                                if (!is_wp_error($attachment_id)) {
                                    $gallery_ids[] = $attachment_id;
                                }
                            }
                        }
                    }
                    
                    // Update gallery meta
                    if (!empty($gallery_ids)) {
                        update_post_meta($edit_house_id, 'house_gallery', $gallery_ids);
                    } else {
                        delete_post_meta($edit_house_id, 'house_gallery');
                    }
                }

                // === КЭШ ЦЭВЭРЛЭХ ===
                if (function_exists('wp_cache_clear_cache')) {
                    wp_cache_clear_cache();
                }
                wp_cache_flush();

                $message = '<p class="success-message">House updated successfully!</p>';
            } else {
                // Шинэ пост үүсгэх
                $post_id = wp_insert_post([
                    'post_type' => 'house',
                    'post_title' => $title,
                    'post_content' => $description,
                    'post_status' => 'publish',
                ]);

                if ($post_id) {
                    update_post_meta($post_id, 'house_size', $house_size);
                    update_post_meta($post_id, 'house_url', $house_url);
                    update_post_meta($post_id, 'video_url', $video_url);

                    // Handle featured image upload for new post
                    if (isset($_FILES['house_featured_image']) && $_FILES['house_featured_image']['error'] === 0) {
                        require_once(ABSPATH . 'wp-admin/includes/image.php');
                        require_once(ABSPATH . 'wp-admin/includes/file.php');
                        require_once(ABSPATH . 'wp-admin/includes/media.php');
                        $attachment_id = media_handle_upload('house_featured_image', $post_id);
                        if (!is_wp_error($attachment_id)) {
                            set_post_thumbnail($post_id, $attachment_id);
                        }
                    } elseif ($featured_image_id) {
                        set_post_thumbnail($post_id, $featured_image_id);
                    }

                    // Handle gallery images for new post
                    if (isset($_FILES['house_gallery'])) {
                        require_once(ABSPATH . 'wp-admin/includes/image.php');
                        require_once(ABSPATH . 'wp-admin/includes/file.php');
                        require_once(ABSPATH . 'wp-admin/includes/media.php');
                        
                        $gallery_ids = array();
                        $files = $_FILES['house_gallery'];
                        
                        // Handle multiple file uploads
                        for ($i = 0; $i < count($files['name']); $i++) {
                            if ($files['error'][$i] === 0) {
                                $file = array(
                                    'name'     => $files['name'][$i],
                                    'type'     => $files['type'][$i],
                                    'tmp_name' => $files['tmp_name'][$i],
                                    'error'    => $files['error'][$i],
                                    'size'     => $files['size'][$i]
                                );
                                
                                $_FILES['gallery_file'] = $file;
                                $attachment_id = media_handle_upload('gallery_file', $post_id);
                                
                                if (!is_wp_error($attachment_id)) {
                                    $gallery_ids[] = $attachment_id;
                                }
                            }
                        }
                        
                        if (!empty($gallery_ids)) {
                            update_post_meta($post_id, 'house_gallery', $gallery_ids);
                        }
                    }

                    // 1 сарын бүх огноог автоматаар үүсгэж бүртгэх
                    $current_date = date('Y-m-d');
                    $next_month_date = date('Y-m-d', strtotime('+1 month'));
                    $date_range = [];

                    for ($date = strtotime($current_date); $date <= strtotime($next_month_date); $date = strtotime('+1 day', $date)) {
                        $date_range[] = date('Y-m-d', $date);
                    }

                    $available_dates = implode(',', $date_range);
                    update_post_meta($post_id, 'available_dates', $available_dates);

                    $message = '<p class="success-message">House added successfully!</p>';
                } else {
                    $message = '<p>Failed to add house. Please try again.</p>';
                }
            }
        }
    }

    // Хаус устгах
    if (isset($_GET['delete_house_id'])) {
        $delete_house_id = absint($_GET['delete_house_id']);
        if (get_post_type($delete_house_id) === 'house') {
            wp_delete_post($delete_house_id, true);
            $message = '<p>House deleted successfully!</p>';
        }
    }

    // Форм болон Listing хэсэг харуулах
    ob_start();
    echo $message;

    // Generate booking link if house was just added or updated
    $show_booking_link = false;
    $booking_post_id = 0;
    if (!empty($post_id)) {
        $show_booking_link = true;
        $booking_post_id = $post_id;
    } elseif (!empty($edit_house_id)) {
        $show_booking_link = true;
        $booking_post_id = $edit_house_id;
    }
    if ($show_booking_link && $booking_post_id) {
        $booking_url = home_url('/house-booking-confirmation') . '?house_id=' . $booking_post_id;
        echo '<div style="margin: 20px 0 30px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">';
        echo '<label for="booking-link" style="font-weight:600;display:block;margin-bottom:6px;">Захиалгын холбоос:</label>';
        echo '<input id="booking-link" type="text" value="' . esc_url($booking_url) . '" readonly style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;background:#f1f3f4;">';
        echo '</div>';
    }

    ?>
    <div class="house-management-wrapper" style="display: flex; gap: 20px;">
        <!-- Form хэсэг -->
        <div style="width: 70%; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4>Бүртгэл нэмэх:</h4>
            <form method="post" action="" class="house-management-form" enctype="multipart/form-data">
                <?php wp_nonce_field('house_management_form', 'house_management_nonce'); ?>

                <div class="form-group">
                    <label for="house_title">Нэр эсвэл Код:</label>
                    <input type="text" id="house_title" name="house_title" value="<?php echo $edit_house_id ? esc_attr(get_the_title($edit_house_id)) : ''; ?>" required>
                </div>

                <div class="form-group">
                    <label for="house_size">Хэмжээ:</label>
                    <select id="house_size" name="house_size" required>
                        <option value="Large" <?php echo $edit_house_id && get_post_meta($edit_house_id, 'house_size', true) === 'Large' ? 'selected' : ''; ?>>Том</option>
                        <option value="Medium" <?php echo $edit_house_id && get_post_meta($edit_house_id, 'house_size', true) === 'Medium' ? 'selected' : ''; ?>>Дунд</option>
                        <option value="Small" <?php echo $edit_house_id && get_post_meta($edit_house_id, 'house_size', true) === 'Small' ? 'selected' : ''; ?>>Жижиг</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="house_description">Тайлбар:</label>
                    <textarea id="house_description" name="house_description" rows="6" style="width:100%;resize:vertical;"><?php echo $edit_house_id ? esc_textarea(get_post_field('post_content', $edit_house_id)) : ''; ?></textarea>
                </div>
                
                <div class="form-group">
                    <label for="house_url">Холбоос (Facebook):</label>
                    <small>Энэ холбоос нь хайлтын үр дүн дэх "ДЭЛГЭРЭНГҮЙ" хэсэгт хадгалагдана.</small>
                    <input type="url" id="house_url" name="house_url" value="<?php echo $edit_house_id ? esc_url(get_post_meta($edit_house_id, 'house_url', true)) : ''; ?>">
                </div>
                
                <div class="form-group">
                    <label for="video_url">Видео холбоос (Facebook, Instagram, Youtube):</label>
                    <input type="url" id="video_url" name="video_url" value="<?php echo $edit_house_id ? esc_url(get_post_meta($edit_house_id, 'video_url', true)) : ''; ?>">
                </div>

                <div class="form-group">
                    <label for="house_featured_image">Онцлох зураг:</label>
                    <input type="file" id="house_featured_image" name="house_featured_image" accept="image/*" style="display: none;">
                    <input type="hidden" id="house_featured_image_id" name="house_featured_image_id" value="<?php echo $edit_house_id ? get_post_thumbnail_id($edit_house_id) : ''; ?>">
                    <button type="button" id="upload_featured_image_button" class="upload-button"><i class="fas fa-upload"></i>
 Зураг сонгох</button>
                    <div id="featured_image_preview" class="image-preview">
                        <?php 
                        if ($edit_house_id && has_post_thumbnail($edit_house_id)) {
                            $image_url = get_the_post_thumbnail_url($edit_house_id, 'medium');
                            echo '<img src="' . esc_url($image_url) . '" alt="Featured Image">';
                        }
                        ?>
                    </div>
                    <p class="image-info">Зөвхөн зурган файл (JPG, PNG). Хамгийн ихдээ: 3MB</p>
                </div>

                <div class="form-group">
                    <label for="house_gallery">Галерей зураг (2-5 зураг):</label>
                    <input type="file" id="house_gallery" name="house_gallery[]" accept="image/*" multiple style="display: none;">
                    <input type="hidden" id="gallery_preview_ids" name="gallery_preview_ids" value="">
                    <button type="button" id="upload_gallery_button" class="upload-button"><i class="fas fa-images"></i> Зургууд сонгох</button>
                    <div id="gallery_preview" class="gallery-preview">
                        <?php
                        if ($edit_house_id) {
                            $gallery_ids = get_post_meta($edit_house_id, 'house_gallery', true);
                            if (!empty($gallery_ids)) {
                                foreach ($gallery_ids as $image_id) {
                                    $image_url = wp_get_attachment_image_url($image_id, 'medium_large');
                                    if ($image_url) {
                                        echo '<div class="gallery-item">';
                                        echo '<img src="' . esc_url($image_url) . '" alt="Gallery Image">';
                                        echo '<button type="button" class="remove-image" data-id="' . esc_attr($image_id) . '"><i class="fas fa-trash"></i>
</button>';
                                        echo '</div>';
                                    }
                                }
                            }
                        }
                        ?>
                    </div>
                    <p class="image-info">Зөвхөн зурган файл (JPG, PNG). Хамгийн ихдээ: 3MB. Хамгийн багадаа: 2 зураг, Хамгийн ихдээ: 5 зураг</p>
                </div>

                <div class="form-actions">
                    <button class="sbm-primary-large" type="submit"><?php echo $edit_house_id ? '<i class="fas fa-save"></i>
 Хадгалах' : '<i class="fas fa-save"></i> Бүртгэх'; ?></button>
                    <button type="button" id="cancel-button" class="cancel-button">Цуцлах</button>
                </div>
            </form>
        </div>

        <!-- Listing хэсэг -->
        <div style="width: 30%; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4>Бүртгэлүүд:</h4>
            <div class="search-box">
                <form method="get" id="house-search-form">
                    <input type="text" id="house-search" name="house_search" placeholder="Хайх..." value="<?php echo isset($_GET['house_search']) ? esc_attr($_GET['house_search']) : ''; ?>">
                </form>
            </div>
            
            <!-- Short URLs Section -->
            <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                <h5 style="margin: 0 0 10px 0; color: #495057;">🔗 Бүх хаусын богино холбоосууд:</h5>
                <div style="max-height: 200px; overflow-y: auto;">
                    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #e9ecef;">
                                <th style="padding: 5px; text-align: left; border: 1px solid #dee2e6;">Хаус</th>
                                <th style="padding: 5px; text-align: left; border: 1px solid #dee2e6;">Богино холбоос</th>
                                <th style="padding: 5px; text-align: center; border: 1px solid #dee2e6;">Хуулах</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $all_houses = new WP_Query([
                                'post_type' => 'house',
                                'posts_per_page' => -1,
                                'post_status' => 'publish',
                                'orderby' => 'title',
                                'order' => 'ASC'
                            ]);
                            
                            if ($all_houses->have_posts()) {
                                while ($all_houses->have_posts()) {
                                    $all_houses->the_post();
                                    $house_id = get_the_ID();
                                    $house_title = get_the_title();
                                    $short_url = home_url('/h/' . $house_id);
                                    ?>
                                    <tr>
                                        <td style="padding: 5px; border: 1px solid #dee2e6; font-size: 11px;"><?php echo esc_html($house_title); ?></td>
                                        <td style="padding: 5px; border: 1px solid #dee2e6; font-size: 11px; font-family: monospace;"><?php echo esc_url($short_url); ?></td>
                                        <td style="padding: 5px; border: 1px solid #dee2e6; text-align: center;">
                                            <button onclick="copyToClipboard('<?php echo esc_js($short_url); ?>')" style="background: #007bff; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">Хуулах</button>
                                        </td>
                                    </tr>
                                    <?php
                                }
                                wp_reset_postdata();
                            }
                            ?>
                        </tbody>
                    </table>
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: #6c757d;">
                    💡 Бүх холбоосыг хуулах: 
                    <button onclick="copyAllShortUrls()" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px;">Бүгдийг хуулах</button>
                </div>
            </div>
            
            <div class="houses-grid">
                <?php
                $paged = (get_query_var('paged')) ? get_query_var('paged') : 1;
                $house_search = isset($_GET['house_search']) ? sanitize_text_field($_GET['house_search']) : '';
                
                $args = [
                    'post_type' => 'house',
                    'posts_per_page' => 5,
                    'post_status' => 'publish',
                    'paged' => $paged
                ];

                if (!empty($house_search)) {
                    $args['s'] = $house_search;
                }

                $query = new WP_Query($args);

                if ($query->have_posts()) {
                    while ($query->have_posts()) {
                        $query->the_post();
                        $post_id = get_the_ID();
                        $permalink = get_permalink($post_id);
                        $featured_image = get_the_post_thumbnail_url($post_id, 'large'); // Changed from 'medium' to 'large'
                        $house_size = get_post_meta($post_id, 'house_size', true);
                        $gallery_ids = get_post_meta($post_id, 'house_gallery', true);
                        $gallery_images = array();
                        if (!empty($gallery_ids)) {
                            foreach ($gallery_ids as $image_id) {
                                $img = wp_get_attachment_image_url($image_id, 'large'); // Changed from 'medium' to 'large'
                                if ($img) $gallery_images[] = $img;
                            }
                        }
                        ?>
                        <div class="house-card">
                            <div class="house-card-image">
                                <?php
                                // Build slider images: featured image first (if exists), then gallery images (no duplicates)
                                $slider_images = array();
                                if ($featured_image) $slider_images[] = $featured_image;
                                foreach ($gallery_images as $img) { if ($img && $img !== $featured_image) $slider_images[] = $img; }
                                ?>
                                <?php if (!empty($slider_images)) : ?>
                                    <div class="mini-slider-container" style="position:relative;width:100%;height:200px;overflow:hidden;border-radius:8px 8px 0 0;">
                                        <div class="mini-slider-wrapper" style="display:flex;transition:transform 0.3s ease;">
                                            <?php foreach ($slider_images as $img) : ?>
                                                <div class="mini-slide" style="min-width:100%;height:200px;">
                                                    <img src="<?php echo esc_url($img); ?>" alt="Gallery Image" style="width:100%;height:100%;object-fit:cover;">
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                        <?php if (count($slider_images) > 1): ?>
                                            <button class="mini-slider-nav prev" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;color:white;border:none;padding:4px 12px;cursor:pointer;border-radius:50%;z-index:1;">❮</button>
                                            <button class="mini-slider-nav next" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;color:white;border:none;padding:4px 12px;cursor:pointer;border-radius:50%;z-index:1;">❯</button>
                                            <div class="mini-slider-dots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:1;">
                                                <?php foreach ($slider_images as $idx => $img) : ?>
                                                    <div class="mini-slider-dot<?php echo $idx === 0 ? ' active' : ''; ?>" style="width:6px;height:6px;border-radius:50%;background-color:<?php echo $idx === 0 ? 'white' : 'rgba(255,255,255,0.5)'; ?>;cursor:pointer;"></div>
                                                <?php endforeach; ?>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                    <script>
                                    (function(){
                                        var card = document.currentScript.parentElement;
                                        var sliderWrapper = card.querySelector('.mini-slider-wrapper');
                                        var slides = card.querySelectorAll('.mini-slide');
                                        var dots = card.querySelectorAll('.mini-slider-dot');
                                        var prevBtn = card.querySelector('.mini-slider-nav.prev');
                                        var nextBtn = card.querySelector('.mini-slider-nav.next');
                                        var currentSlide = 0;
                                        var totalSlides = slides.length;
                                        function goToSlide(idx) {
                                            currentSlide = idx;
                                            sliderWrapper.style.transform = 'translateX(-' + (idx * 100) + '%)';
                                            if (dots.length) {
                                                dots.forEach(function(dot, i) {
                                                    dot.style.backgroundColor = i === idx ? 'white' : 'rgba(255,255,255,0.5)';
                                                });
                                            }
                                        }
                                        if (prevBtn && nextBtn) {
                                            prevBtn.onclick = function() {
                                                currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
                                                goToSlide(currentSlide);
                                            };
                                            nextBtn.onclick = function() {
                                                currentSlide = (currentSlide + 1) % totalSlides;
                                                goToSlide(currentSlide);
                                            };
                                        }
                                        if (dots.length) {
                                            dots.forEach(function(dot, i) {
                                                dot.onclick = function() { goToSlide(i); };
                                            });
                                        }
                                    })();
                                    </script>
                                <?php else : ?>
                                    <div class="no-image">No Image</div>
                                <?php endif; ?>
                                <div class="house-size-badge <?php echo strtolower($house_size); ?>"><?php echo $house_size; ?></div>
                            </div>
                            <div class="house-card-content">
                                <div style="display:flex;align-items:center;justify-content:space-between;">
                                    <h4 style="margin-bottom:10px;"><?php the_title(); ?></h4>
                                    <?php
                                    $booking_link = home_url('/house-booking-confirmation') . '?house_id=' . $post_id;
                                    $short_url = home_url('/h/' . $post_id);
                                    ?>
                                    <div style="position: relative; display: inline-block;">
                                        <button class="secondary-btn-view copy-booking-link-btn" data-booking-link="<?php echo esc_url($booking_link); ?>" data-short-link="<?php echo esc_url($short_url); ?>" style="position:relative;font-size:10px;padding:4px 8px;line-height:1.2;min-width:40px;">
                                            <i class="fas fa-copy"></i> ХОЛБООС
                                            <span class="copy-tooltip" style="display:none;position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#06d6a0;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;z-index:10;">Хуулагдлаа!</span>
                                        </button>
                                        <div class="copy-dropdown" style="display:none;position:absolute;top:100%;right:0;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);z-index:1000;min-width:200px;">
                                            <div style="padding:8px;border-bottom:1px solid #eee;font-size:11px;font-weight:bold;">Холбоос сонгох:</div>
                                            <button onclick="copyToClipboard('<?php echo esc_js($booking_link); ?>')" style="width:100%;padding:8px;border:none;background:none;text-align:left;cursor:pointer;font-size:11px;border-bottom:1px solid #f0f0f0;">
                                                📋 Урт холбоос (Бүрэн)
                                            </button>
                                            <button onclick="copyToClipboard('<?php echo esc_js($short_url); ?>')" style="width:100%;padding:8px;border:none;background:none;text-align:left;cursor:pointer;font-size:11px;">
                                                🔗 Богино холбоос (/h/<?php echo $post_id; ?>)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div style="font-size:11px;color:#888;margin-bottom:6px;">
                                    <?php echo 'Шинэчлэгдсэн: ' . get_the_modified_date('Y-m-d H:i'); ?>
                                </div>
                                <div class="house-card-actions">
                                    <a class="secondary-btn-edit" href="?edit_house_id=<?php echo $post_id; ?>">Засах</a>
                                    <a class="secondary-btn-delete" href="?delete_house_id=<?php echo $post_id; ?>" onclick="return confirm('Are you sure you want to delete this house?');">Устгах</a>
                                </div>
                            </div>
                        </div>
                        <?php
                    }
                    ?>
                    <div class="pagination">
                        <?php
                        echo paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => __('&laquo;'),
                            'next_text' => __('&raquo;'),
                            'total' => $query->max_num_pages,
                            'current' => $paged
                        ));
                        ?>
                    </div>
                    <?php
                    wp_reset_postdata();
                } else {
                    ?>
                    <div class="no-houses">No houses found.</div>
                    <?php
                }
                ?>
            </div>
        </div>
    </div>
    
    <style>
        .success-message {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            padding: 10px 15px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            margin: 10px 0;
            display: inline-block;
            box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        .house-management-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-group label {
            font-weight: 600;
            color: #333;
        }

        .form-group input[type="text"],
        .form-group input[type="url"],
        .form-group select,
        .form-group textarea {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.3s ease;
        }

        .form-group input[type="text"]:focus,
        .form-group input[type="url"]:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            border-color: #a7c957;
            outline: none;
            box-shadow: 0 0 0 2px rgba(167, 201, 87, 0.2);
        }

        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        .sbm-primary-large {
            width:220px;
            background-color: #a7c957;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: background-color 0.3s ease;
        }
        
        .sbm-primary-large:hover {
            background-color: #6a994e;
        }

        .cancel-button {
            background-color: #e9ecef;
            color: #343a40;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: background-color 0.3s ease;
        }

        .cancel-button:hover {
            color: #343a40;
            background-color: #dee2e6;
        }
        
        .upload-button {
            background-color: #343a40;
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }

        .upload-button:hover {
            background-color: #212529;
        }

        .image-preview {
            margin-top: 10px;
        }

        .image-preview img {
            max-width: 200px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .houses-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 15px;
            margin-top: 15px;
        }

        .house-card {
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .house-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .house-card-image {
            position: relative;
            width: 100%;
            height: 150px;
            overflow: hidden;
        }

        .house-card-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .no-image {
            width: 100%;
            height: 100%;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
            font-size: 14px;
        }

        .house-size-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 4px 8px;
            border-radius: 4px;
            color: white;
            font-size: 12px;
            font-weight: 500;
        }

        .house-size-badge.large {
            background-color: #6a994e;
        }

        .house-size-badge.medium {
            background-color: #ef233c;
        }

        .house-size-badge.small {
            background-color: #06d6a0;
        }

        .house-card-content {
            padding: 15px;
        }

        .house-card-content h4 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #333;
        }

        .house-card-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .house-card-actions a {
            flex: 1;
            text-align: center;
            padding: 6px 12px;
            border-radius: 4px;
            color: white;
            text-decoration: none !important;
            font-size: 12px;
            transition: background-color 0.3s ease;
        }

        .secondary-btn-view {
            color: #6c757d;
            background-color: #e9ecef;
        }
        
        .secondary-btn-view:hover {
            color: #343a40;
            background-color: #dee2e6;
        }
        
        .secondary-btn-edit {
            background-color: #06d6a0;
        }
        
        .secondary-btn-edit:hover {
            background-color: #2a9d8f;
        }
        
        .secondary-btn-delete {
            background-color: #ef233c;
        }
        
        .secondary-btn-delete:hover {
            background-color: #d90429;
        }

        .no-houses {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .pagination {
            margin-top: 20px;
            text-align: center;
        }

        .pagination .page-numbers {
            display: inline-block;
            padding: 5px 10px;
            margin: 0 2px;
            border: 1px solid #ddd;
            border-radius: 4px;
            color: #333;
            text-decoration: none;
            transition: all 0.3s ease;
        }

        .pagination .page-numbers.current {
            background-color: #a7c957;
            color: white;
            border-color: #a7c957;
        }

        .pagination .page-numbers:hover:not(.current) {
            background-color: #f8f9fa;
            border-color: #a7c957;
        }

        .pagination .page-numbers.prev,
        .pagination .page-numbers.next {
            background-color: #f8f9fa;
        }

        .pagination .page-numbers.prev:hover,
        .pagination .page-numbers.next:hover {
            background-color: #e9ecef;
        }

        .search-box {
            margin-bottom: 15px;
        }

        .search-box input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.3s ease;
        }

        .search-box input:focus {
            outline: none;
            border-color: #a7c957;
            box-shadow: 0 0 0 2px rgba(167, 201, 87, 0.2);
        }

        .image-info {
            margin-top: 5px;
            font-size: 12px;
            color: #6c757d;
        }

        .image-preview img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin-top: 10px;
        }

        .gallery-preview {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            flex-wrap: wrap;
        }

        .gallery-item {
            position: relative;
            width: 150px;
            height: 150px;
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
        }

        .gallery-item .remove-image {
            position: absolute;
            top: 3px;
            right: 1px;
            background: none !important;
            color: red;
            border: none;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
            padding: 4px;
            z-index: 10;
        }

        /* Slider styles */
        .house-gallery-slider {
            margin-top: 20px;
            position: relative;
            max-width: 100%;
            overflow: hidden;
        }

        .slider-container {
            display: flex;
            transition: transform 0.3s ease;
        }

        .slider-item {
            min-width: 100%;
            height: 300px;
        }

        .slider-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .slider-nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 100%;
            display: flex;
            justify-content: space-between;
            padding: 0 10px;
        }

        .slider-nav button {
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .slider-dots {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 5px;
        }

        .slider-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            cursor: pointer;
        }

        .slider-dot.active {
            background: white;
        }

        /* Loading Overlay Styles */
        .loading-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        }

        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #a7c957;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        .loading-text {
            margin-top: 15px;
            color: #333;
            font-size: 16px;
            font-weight: 500;
        }
        
        @media (max-width: 768px) {
            .house-management-wrapper {
                flex-direction: column !important;
            }
        
            .house-management-wrapper > div {
                width: 100% !important;
            }
        
            .form-actions {
                flex-direction: column;
                gap: 12px;
            }
        
            .sbm-primary-large,
            .cancel-button,
            .upload-button {
                width: 100%;
            }
        
            .house-card-actions {
                flex-direction: column;
                gap: 6px;
            }
        }
    </style>

    <!-- Add Loading Overlay HTML -->
    <div class="loading-overlay">
        <div style="text-align: center;">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading...</div>
        </div>
    </div>

    <script>
        document.addEventListener("DOMContentLoaded", function() {
            const fileInput = document.getElementById('house_featured_image');
            const uploadButton = document.getElementById('upload_featured_image_button');
            const imagePreview = document.getElementById('featured_image_preview');
            const imageIdInput = document.getElementById('house_featured_image_id');
            const houseForm = document.querySelector("form");
            const cancelButton = document.getElementById("cancel-button");
            const loadingOverlay = document.querySelector('.loading-overlay');

            // Show loading overlay
            function showLoading() {
                loadingOverlay.style.display = 'flex';
            }

            // Hide loading overlay
            function hideLoading() {
                loadingOverlay.style.display = 'none';
            }

            // Form submission handling
            houseForm.addEventListener('submit', function(e) {
                const totalImages = existingImageIds.length + galleryFiles.length;
                if (totalImages < 2) {
                    e.preventDefault();
                    alert('Та хамгийн багадаа 2 зураг оруулна уу!');
                    return;
                }
                
                // Create FormData object
                const formData = new FormData(houseForm);
                
                // Append gallery files
                galleryFiles.forEach((file, index) => {
                    formData.append('house_gallery[]', file);
                });
                
                showLoading();
            });

            // Handle form submission completion
            window.addEventListener('load', function() {
                hideLoading();
            });

            // Handle form submission errors
            window.addEventListener('error', function() {
                hideLoading();
            });

            uploadButton.addEventListener("click", function(e) {
                e.preventDefault();
                fileInput.click();
            });

            fileInput.addEventListener("change", function(e) {
                const file = e.target.files[0];
                if (file) {
                    // Check file size (3MB = 3 * 1024 * 1024 bytes)
                    if (file.size > 3 * 1024 * 1024) {
                        alert('Зурагны хэмжээ 3MB-ээс хэтэрч болохгүй!');
                        fileInput.value = '';
                        return;
                    }

                    // Check if file is an image
                    if (!file.type.startsWith('image/')) {
                        alert('Зөвхөн зураг файл оруулна уу!');
                        fileInput.value = '';
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = function(e) {
                        imagePreview.innerHTML = `<img src="${e.target.result}" alt="Featured Image">`;
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Gallery functionality
            const galleryInput = document.getElementById('house_gallery');
            const uploadGalleryButton = document.getElementById('upload_gallery_button');
            const galleryPreview = document.getElementById('gallery_preview');
            const galleryPreviewIds = document.getElementById('gallery_preview_ids');
            let galleryFiles = [];
            let existingImageIds = [];

            // Initialize existing image IDs
            document.querySelectorAll('.gallery-item .remove-image').forEach(btn => {
                if (btn.dataset.id) {
                    existingImageIds.push(parseInt(btn.dataset.id));
                }
            });
            updateGalleryPreviewIds();

            function updateGalleryPreviewIds() {
                galleryPreviewIds.value = existingImageIds.join(',');
            }

            uploadGalleryButton.addEventListener("click", function(e) {
                e.preventDefault();
                galleryInput.click();
            });

            galleryInput.addEventListener("change", function(e) {
                const files = Array.from(e.target.files);
                
                // Check total number of images
                if (existingImageIds.length + galleryFiles.length + files.length > 5) {
                    alert('Та хамгийн ихдээ 5 зураг оруулж болно!');
                    galleryInput.value = '';
                    return;
                }

                // Validate each file
                files.forEach(file => {
                    if (file.size > 3 * 1024 * 1024) {
                        alert('Зурагны хэмжээ 3MB-ээс хэтэрч болохгүй!');
                        return;
                    }

                    if (!file.type.startsWith('image/')) {
                        alert('Зөвхөн зураг файл оруулна уу!');
                        return;
                    }

                    galleryFiles.push(file);
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const div = document.createElement('div');
                        div.className = 'gallery-item';
                        div.innerHTML = `
                            <img src="${e.target.result}" alt="Gallery Image">
                            <button type="button" class="remove-image" data-index="${galleryFiles.length - 1}"><i class="fas fa-times"></i>
</button>
                        `;
                        galleryPreview.appendChild(div);
                    };
                    reader.readAsDataURL(file);
                });
            });

            // Remove image from gallery
            galleryPreview.addEventListener('click', function(e) {
                const removeButton = e.target.closest('.remove-image');
                if (removeButton) {
                    if (removeButton.dataset.id) {
                        // Remove existing image
                        const imageId = parseInt(removeButton.dataset.id);
                        existingImageIds = existingImageIds.filter(id => id !== imageId);
                        updateGalleryPreviewIds();
                    } else {
                        // Remove new image
                        const index = parseInt(removeButton.dataset.index);
                        galleryFiles.splice(index, 1);
                        
                        // Update indices for new images only
                        document.querySelectorAll('.gallery-item .remove-image').forEach((btn) => {
                            if (!btn.dataset.id) {
                                const currentIndex = parseInt(btn.dataset.index);
                                if (currentIndex > index) {
                                    btn.dataset.index = currentIndex - 1;
                                }
                            }
                        });
                    }
                    removeButton.closest('.gallery-item').remove();
                }
            });

            // Reset form on Cancel button click
            cancelButton.addEventListener("click", function() {
                houseForm.reset();
                imagePreview.innerHTML = "";
                galleryPreview.innerHTML = "";
                window.location.href = window.location.origin + window.location.pathname;
            });

            document.querySelectorAll('.copy-booking-link-btn').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var dropdown = btn.parentElement.querySelector('.copy-dropdown');
                    if (dropdown) {
                        // Toggle dropdown
                        if (dropdown.style.display === 'none') {
                            dropdown.style.display = 'block';
                        } else {
                            dropdown.style.display = 'none';
                        }
                    } else {
                        // Fallback to old behavior
                        var link = btn.getAttribute('data-booking-link');
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(link).then(function() {
                                var tooltip = btn.querySelector('.copy-tooltip');
                                if (tooltip) {
                                    tooltip.style.display = 'block';
                                    setTimeout(function() { tooltip.style.display = 'none'; }, 1200);
                                }
                            });
                        } else {
                            // fallback for older browsers
                            var tempInput = document.createElement('input');
                            tempInput.value = link;
                            document.body.appendChild(tempInput);
                            tempInput.select();
                            document.execCommand('copy');
                            document.body.removeChild(tempInput);
                            var tooltip = btn.querySelector('.copy-tooltip');
                            if (tooltip) {
                                tooltip.style.display = 'block';
                                setTimeout(function() { tooltip.style.display = 'none'; }, 1200);
                            }
                        }
                    }
                });
            });
            
            // Close dropdowns when clicking outside
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.copy-booking-link-btn')) {
                    document.querySelectorAll('.copy-dropdown').forEach(function(dropdown) {
                        dropdown.style.display = 'none';
                    });
                }
            });
        });
        
        // Function to copy individual short URL
        function copyToClipboard(text) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function() {
                    showTooltip('Холбоос хуулагдлаа!', event);
                });
            } else {
                // fallback for older browsers
                var tempInput = document.createElement('input');
                tempInput.value = text;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showTooltip('Холбоос хуулагдлаа!', event);
            }
        }
        
        // Function to copy all short URLs
        function copyAllShortUrls() {
            var urls = [];
            var rows = document.querySelectorAll('table tbody tr');
            rows.forEach(function(row) {
                var urlCell = row.querySelector('td:nth-child(2)');
                if (urlCell) {
                    urls.push(urlCell.textContent.trim());
                }
            });
            
            var allUrlsText = urls.join('\n');
            if (navigator.clipboard) {
                navigator.clipboard.writeText(allUrlsText).then(function() {
                    showTooltip('Бүх холбоосууд хуулагдлаа! (' + urls.length + ' холбоос)', event);
                });
            } else {
                // fallback for older browsers
                var tempInput = document.createElement('textarea');
                tempInput.value = allUrlsText;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showTooltip('Бүх холбоосууд хуулагдлаа! (' + urls.length + ' холбоос)', event);
            }
        }
        
        // Function to show tooltip
        function showTooltip(message, event) {
            // Remove any existing tooltips
            var existingTooltip = document.querySelector('.copy-tooltip-global');
            if (existingTooltip) {
                existingTooltip.remove();
            }
            
            // Create tooltip
            var tooltip = document.createElement('div');
            tooltip.className = 'copy-tooltip-global';
            tooltip.textContent = message;
            tooltip.style.cssText = 'position:fixed;top:20px;right:20px;background:#06d6a0;color:#fff;padding:10px 15px;border-radius:6px;font-size:14px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:fadeInOut 2s ease-in-out;';
            
            // Add animation CSS
            var style = document.createElement('style');
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-10px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(tooltip);
            
            // Remove tooltip after animation
            setTimeout(function() {
                if (tooltip.parentNode) {
                    tooltip.remove();
                }
            }, 2000);
        }
    </script>
    <?php

    return ob_get_clean();
}
add_shortcode('house_form_with_list', 'house_management_frontend_form_with_list_shortcode');

function save_house_meta($post_id) {
    if (get_post_type($post_id) === 'house') {
        // Хаусны хэмжээ хадгалах
        if (isset($_POST['house_size'])) {
            $house_size = sanitize_text_field($_POST['house_size']);
            update_post_meta($post_id, 'house_size', $house_size);
        }

        // Огноо хадгалах
        if (isset($_POST['available_dates'])) {
            $available_dates = sanitize_text_field($_POST['available_dates']);
            update_post_meta($post_id, 'available_dates', $available_dates);
        }

        // Хаус холбоос хадгалах
        if (isset($_POST['house_url'])) {
            $house_url = esc_url_raw($_POST['house_url']);
            update_post_meta($post_id, 'house_url', $house_url);
        }

        // Видео холбоос хадгалах
        if (isset($_POST['video_url'])) {
            $video_url = esc_url_raw($_POST['video_url']);
            update_post_meta($post_id, 'video_url', $video_url);
        }
    }
}
add_action('save_post', 'save_house_meta');

function enqueue_editor_scripts() {
    wp_enqueue_editor();
    wp_enqueue_media();
}
add_action('wp_enqueue_scripts', 'enqueue_editor_scripts');
add_action('admin_enqueue_scripts', 'enqueue_editor_scripts');

function delete_house(WP_REST_Request $request) {
    $post_id = $request->get_param('id');

    if (get_post_type($post_id) === 'house') {
        wp_delete_post($post_id, true);
        return new WP_REST_Response(['message' => 'House deleted successfully.'], 200);
    }

    return new WP_REST_Response(['message' => 'Invalid house ID.'], 400);
}
add_action('rest_api_init', function () {
    register_rest_route('house/v1', '/delete', [
        'methods' => 'DELETE',
        'callback' => 'delete_house',
        'permission_callback' => '__return_true',
    ]);
});

// === REST API: Get Houses by Date ===
function get_houses_by_date_and_size(WP_REST_Request $request) {
    $selected_date = trim(sanitize_text_field($request->get_param('date')));
    $selected_size = trim(sanitize_text_field($request->get_param('size')));

    if (empty($selected_date) || empty($selected_size)) {
        return new WP_REST_Response(['message' => 'Date and size parameters are required.'], 400);
    }

    // Excerpt уртыг тохируулах
    add_filter('excerpt_length', function($length) {
        return 10; // Excerpt уртыг хүссэн үгээрээ тохируул
    }, 999);

    // Excerpt-ийн "&hellip;" тэмдэглэгээг арилгах
    add_filter('excerpt_more', function($more) {
        return ''; // "&hellip;"-ийг арилгах
    });

    $args = [
        'post_type' => 'house',
        'posts_per_page' => -1,
        'post_status' => 'publish',
        'meta_query' => [
            [
                'key' => 'house_size',
                'value' => $selected_size,
                'compare' => '='
            ],
            [
                'key' => 'available_dates',
                'value' => $selected_date,
                'compare' => 'LIKE'
            ]
        ]
    ];

    $query = new WP_Query($args);
    $houses = [];
    $grouped_houses = []; // 5-аар багцлахад ашиглана

    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $post_id = get_the_ID();

            // house_url мета өгөгдлийг авах
            $house_url = get_post_meta($post_id, 'house_url', true);
            $video_url = get_post_meta($post_id, 'video_url', true);

            // URL ашиглах ба "View Link" хэсгийг үүсгэх
            if ($house_url || $video_url) {
                $house_data = "🏠 " . get_the_title();
                if ($house_url) {
                    $house_data .= "\n🔗 Дэлгэрэнгүй: (" . esc_url($house_url) . ")";
                }
                if ($video_url) {
                    $house_data .= "\n🎥 Видео: (" . esc_url($video_url) . ")";
                }
                $houses[] = $house_data;
            }
        }
        wp_reset_postdata();
    }

    if (empty($houses)) {
        return new WP_REST_Response(['message' => 'Уучлаарай энэ өдөр сул хаус байхгүй байна, та өөр өдрүүдээс үзнэ үү.'], 200);
    }

    // Хаусуудыг 5-аар багцлах
    $chunks = array_chunk($houses, 5); // 5-аар багцална
    foreach ($chunks as $chunk) {
        $grouped_houses[] = implode("\n\n", $chunk); // Нэг мессежид 5 хаусыг багцална
    }

    // Буцаах формат
    return new WP_REST_Response(['available_houses' => $grouped_houses], 200);
}

// REST API Route бүртгэх
add_action('rest_api_init', function () {
    register_rest_route('house/v1', '/filter', [
        'methods' => 'GET',
        'callback' => 'get_houses_by_date_and_size',
        'permission_callback' => '__return_true',
    ]);
});


function remove_nbsp_from_content($content) {
    return str_replace('&nbsp;', ' ', $content); // &nbsp; тэмдэглэгээг энгийн зайгаар солих
}
add_filter('the_content', 'remove_nbsp_from_content'); // Контент дотроос арилгах
add_filter('the_excerpt', 'remove_nbsp_from_content'); // Excerpt дотроос арилгах

// Increase WordPress image sizes
add_action('after_setup_theme', 'increase_image_sizes');
function increase_image_sizes() {
    // Set larger image sizes
    update_option('large_size_w', 1920);
    update_option('large_size_h', 1080);
    update_option('medium_size_w', 1200);
    update_option('medium_size_h', 800);
    update_option('medium_large_size_w', 1600);
    update_option('medium_large_size_h', 900);
}

// Improve image quality
add_filter('jpeg_quality', function($quality) {
    return 90; // Increase JPEG quality to 90%
});
add_filter('wp_editor_set_quality', function($quality) {
    return 90; // Increase editor quality to 90%
});