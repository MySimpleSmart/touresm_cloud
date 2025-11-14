<?php
// Shortcode: [house_booking_list]
add_shortcode('house_booking_list', 'display_house_booking_list');

function display_house_booking_list() {
    ob_start();

    if (isset($_POST['update_status_id'], $_POST['booking_status'])) {
        $post_id = intval($_POST['update_status_id']);
        $new_status = sanitize_text_field($_POST['booking_status']);
        if (in_array($new_status, ['pending', 'confirmed', 'cancelled'])) {
            update_post_meta($post_id, 'booking_status', $new_status);
        }
    }

    $filter_status = isset($_GET['status_filter']) ? sanitize_text_field($_GET['status_filter']) : '';
    $search_term = isset($_GET['search']) ? sanitize_text_field($_GET['search']) : '';
    $start_date = isset($_GET['start_date']) ? sanitize_text_field($_GET['start_date']) : '';
    $end_date = isset($_GET['end_date']) ? sanitize_text_field($_GET['end_date']) : '';
    
    // Pagination settings
    $items_per_page = 10;
    $paged = (get_query_var('paged')) ? get_query_var('paged') : 1;

    // Handle delete action
    if (isset($_POST['delete_booking_id'])) {
        $booking_id = intval($_POST['delete_booking_id']);
        wp_delete_post($booking_id, true);
        // No redirect here - we'll handle it with JavaScript
    }

    // Build the query
    $args = array(
        'post_type' => 'house_booking',
        'post_status' => 'publish',
        'posts_per_page' => $items_per_page,
        'paged' => $paged,
        'orderby' => 'date',
        'order' => 'DESC'
    );

    // Add meta query for status filter if set
    if (!empty($filter_status)) {
        $args['meta_query'] = array(
            array(
                'key' => 'booking_status',
                'value' => $filter_status,
                'compare' => '='
            )
        );
    }

    // Create a new query
    $query = new WP_Query($args);
    $total_posts = $query->found_posts;
    $total_pages = $query->max_num_pages;

    // Debug information
    if (current_user_can('administrator')) {
        echo '<!-- Debug: Current Page: ' . $paged . ' -->';
        echo '<!-- Debug: Total Posts: ' . $total_posts . ' -->';
        echo '<!-- Debug: Total Pages: ' . $total_pages . ' -->';
        echo '<!-- Debug: Posts Found: ' . $query->found_posts . ' -->';
    }
    ?>

    <form method="get" style="margin-bottom:20px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
        <div>
            <label for="status_filter">Статус:</label><br>
            <select name="status_filter" onchange="this.form.submit()">
                <option value="">-- Бүгд --</option>
                <option value="pending" <?php selected($filter_status, 'pending'); ?>>Хүлээгдэж</option>
                <option value="confirmed" <?php selected($filter_status, 'confirmed'); ?>>Баталгаажсан</option>
                <option value="cancelled" <?php selected($filter_status, 'cancelled'); ?>>Цуцлагдсан</option>
            </select>
        </div>

        <div>
            <label for="search">Хайх:</label><br>
            <input type="text" name="search" value="<?php echo esc_attr($search_term); ?>" placeholder="Хаус, утас..." oninput="this.form.submit()">
        </div>

        <div>
            <label for="start_date">Эхлэх:</label><br>
            <input type="date" name="start_date" value="<?php echo esc_attr($start_date); ?>" onchange="this.form.submit()">
        </div>

        <div>
            <label for="end_date">Дуусах:</label><br>
            <input type="date" name="end_date" value="<?php echo esc_attr($end_date); ?>" onchange="this.form.submit()">
        </div>

        <div>
            <label>&nbsp;</label><br>
            <a href="<?php echo remove_query_arg(['search', 'status_filter', 'start_date', 'end_date', 'paged']); ?>" 
               style="display: inline-block; padding: 4px 12px; background: #495057; color: white; text-decoration: none; border-radius: 4px;">
                Арилгах <i class="fas fa-times" style="color: white;"></i>
            </a>
        </div>
    </form>

    <style>
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            color: white;
        }
        .badge-pending { background: #f9c74f; }
        .badge-confirmed { background: #43aa8b; }
        .badge-cancelled { background: #f94144; }
        .modal-overlay {
            display: none;
            position: fixed;
            z-index: 9999;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.6);
            justify-content: center;
            align-items: center;
        }
        .modal-content {
            background: white;
            padding: 20px;
            border-radius: 6px;
            max-width: 600px;
            width: 90%;
            position: relative;
        }
        .modal-close {
            position: absolute;
            top: 10px; right: 15px;
            font-size: 20px;
            cursor: pointer;
        }

        /* Responsive table styles */
        @media screen and (max-width: 768px) {
            table {
                display: block;
                width: 100%;
            }
            
            thead {
                display: none;
            }
            
            tbody {
                display: block;
                width: 100%;
            }
            
            tr {
                display: block;
                margin-bottom: 20px;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 10px;
                background: #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            td {
                display: block;
                text-align: right;
                padding: 8px;
                position: relative;
                border-bottom: 1px solid #eee;
            }
            
            td:last-child {
                border-bottom: none;
            }
            
            td:before {
                content: attr(data-label);
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                font-weight: bold;
                color: #666;
            }

            /* Hide the first column (number) on mobile */
            td:first-child {
                display: none;
            }

            /* Make action buttons more touch-friendly */
            td:last-child {
                text-align: center;
            }

            td:last-child:before {
                display: none;
            }

            /* Adjust form elements in mobile view */
            select, input[type="text"], input[type="date"] {
                width: 100%;
                padding: 8px;
                margin: 4px 0;
            }

            /* Make the filter form more mobile-friendly */
            form[method="get"] {
                flex-direction: column;
                gap: 15px;
            }

            form[method="get"] > div {
                width: 100%;
            }
        }
    </style>

    <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <thead>
            <tr style="background:#343a40; color:white;">
                <th>#</th><th>Нэр</th><th>Хэмжээ</th><th>Орох</th><th>Гарах</th><th>Утас</th>
                <th>Facebook</th><th>Зочид</th><th>Тайлбар</th><th>Баримт (Зураг)</th><th>Илгээсэн огноо</th><th>Төлөв</th><th>Үйлдэл</th>
            </tr>
        </thead>
        <tbody>
            <?php
            if ($query->have_posts()) {
                $i = 1;
                while ($query->have_posts()) {
                    $query->the_post();
                    $post_id = get_the_ID();
                    $meta = get_post_meta($post_id, 'booking_data', true);
                    $status = get_post_meta($post_id, 'booking_status', true) ?: 'pending';

                    if ($filter_status && $status !== $filter_status) continue;
                    if ($search_term) {
                        $haystack = strtolower(($meta['house_name'] ?? '') . ($meta['phone'] ?? '') . ($meta['facebook_name'] ?? ''));
                        if (stripos($haystack, strtolower($search_term)) === false) continue;
                    }

                    // Date filtering logic
                    $checkin_date = $meta['checkin'] ?? '';
                    $checkout_date = $meta['checkout'] ?? '';
                    
                    if ($start_date && $checkin_date && strtotime($checkin_date) < strtotime($start_date)) continue;
                    if ($end_date && $checkout_date && strtotime($checkout_date) > strtotime($end_date)) continue;

                    $full_msg = esc_html($meta['message'] ?? '-');
                    $short_msg = mb_strimwidth($full_msg, 0, 40, '...');
                    ?>
                    <tr>
                        <td data-label="#"><?php echo $i++; ?></td>
                        <td data-label="Нэр"><?php echo esc_html($meta['house_name'] ?? '-'); ?></td>
                        <td data-label="Хэмжээ"><?php echo esc_html($meta['house_size'] ?? '-'); ?></td>
                        <td data-label="Орох"><?php echo esc_html($meta['checkin'] ?? '-'); ?></td>
                        <td data-label="Гарах"><?php echo esc_html($meta['checkout'] ?? '-'); ?></td>
                        <td data-label="Утас"><?php echo esc_html($meta['phone'] ?? '-'); ?></td>
                        <td data-label="Facebook"><?php echo esc_html($meta['facebook_name'] ?? '-'); ?></td>
                        <td data-label="Зочид"><?php echo esc_html($meta['guests'] ?? '-'); ?></td>
                        <td data-label="Тайлбар">
                            <a href="javascript:void(0);" onclick="showMessageModal(<?php echo $post_id; ?>)"><?php echo $short_msg; ?></a>
                            <div id="modal-<?php echo $post_id; ?>" class="modal-overlay">
                                <div class="modal-content">
                                    <span class="modal-close" onclick="closeMessageModal(<?php echo $post_id; ?>)">&times;</span>
                                    <h4>Захиалгын тайлбар</h4>
                                    <p><?php echo nl2br($full_msg); ?></p>
                                </div>
                            </div>
                        </td>
                        <td data-label="Баримт">
                            <?php if (!empty($meta['id_image'])): ?>
                                <a href="javascript:void(0);" onclick="showImageModal('<?php echo esc_url($meta['id_image']); ?>', '<?php echo esc_js($meta['house_name'] ?? 'Захиалга'); ?>')">Баримт харах</a>
                            <?php else: ?>-
                            <?php endif; ?>
                        </td>
                        <td data-label="Илгээсэн огноо"><?php echo get_the_date('Y-m-d H:i'); ?></td>
                        <td data-label="Төлөв">
                            <span class="badge badge-<?php echo $status; ?>">
                                <?php echo ($status === 'pending' ? 'Хүлээгдэж' : ($status === 'confirmed' ? 'Баталгаажсан' : 'Цуцлагдсан')); ?>
                            </span>
                        </td>
                        <td data-label="Үйлдэл">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <form method="post" style="margin: 0;">
                                    <input type="hidden" name="update_status_id" value="<?php echo $post_id; ?>">
                                    <select name="booking_status" onchange="this.form.submit()" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd;">
                                        <option value="pending" <?php selected($status, 'pending'); ?>>Хүлээгдэж</option>
                                        <option value="confirmed" <?php selected($status, 'confirmed'); ?>>Баталгаажсан</option>
                                        <option value="cancelled" <?php selected($status, 'cancelled'); ?>>Цуцлагдсан</option>
                                    </select>
                                </form>
                                <form method="post" onsubmit="return handleDelete(this);" style="margin: 0;">
                                    <input type="hidden" name="delete_booking_id" value="<?php echo $post_id; ?>">
                                    <button type="submit" style="background: #ef233c; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        <span style="font-size: 14px;">×</span>
                                    </button>
                                </form>
                            </div>
                        </td>
                    </tr>
                    <?php
                }
            } else {
                echo '<tr><td colspan="12" style="text-align:center;">Бүртгэл үүсээгүй байна.</td></tr>';
            }
            wp_reset_postdata();
            ?>
        </tbody>
    </table>

    <?php if ($total_pages > 1): ?>
    <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="color: #666;">
            Нийт: <?php echo $total_posts; ?> захиалга
        </div>
        <div class="pagination">
            <?php
            $big = 999999999;
            echo paginate_links(array(
                'base' => str_replace($big, '%#%', esc_url(get_pagenum_link($big))),
                'format' => '?paged=%#%',
                'current' => $paged,
                'total' => $total_pages,
                'prev_text' => '&laquo;',
                'next_text' => '&raquo;',
                'type' => 'plain',
                'add_args' => array(
                    'status_filter' => $filter_status,
                    'search' => $search_term,
                    'start_date' => $start_date,
                    'end_date' => $end_date
                )
            ));
            ?>
        </div>
    </div>
    <?php else: ?>
    <div style="margin-top: 20px; color: #666;">
        Нийт: <?php echo $total_posts; ?> захиалга
    </div>
    <?php endif; ?>

    <style>
        .pagination {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .pagination a,
        .pagination span {
            display: inline-block;
            padding: 5px 10px;
            border: 1px solid #ddd;
            border-radius: 3px;
            text-decoration: none;
            color: #333;
            font-size: 14px;
        }
        .pagination span.current {
            background: #386641;
            color: white;
            border-color: #386641;
        }
        .pagination a:hover {
            background: #f5f5f5;
        }
    </style>

    <script>
        function showMessageModal(id) {
            document.getElementById("modal-" + id).style.display = "flex";
        }
        function closeMessageModal(id) {
            document.getElementById("modal-" + id).style.display = "none";
        }

        function showImageModal(imageUrl, title) {
            // Create modal HTML if it doesn't exist
            let modalId = 'image-modal';
            let modal = document.getElementById(modalId);
            
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.className = 'modal-overlay';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow: auto;">
                        <span class="modal-close" onclick="closeImageModal()">&times;</span>
                        <h4 id="image-modal-title"></h4>
                        <div style="text-align: center; margin-top: 15px;">
                            <img id="image-modal-img" style="max-width: 100%; height: auto; border-radius: 4px;" />
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }
            
            // Update modal content
            document.getElementById('image-modal-title').textContent = title + ' - Баримт';
            document.getElementById('image-modal-img').src = imageUrl;
            
            // Show modal
            modal.style.display = "flex";
        }
        
        function closeImageModal() {
            let modal = document.getElementById('image-modal');
            if (modal) {
                modal.style.display = "none";
            }
        }

        function handleDelete(form) {
            if (confirm('Устгах уу?')) {
                // Submit the form using fetch
                fetch(window.location.href, {
                    method: 'POST',
                    body: new FormData(form)
                }).then(() => {
                    // After successful deletion, reload the page
                    window.location.reload();
                });
                return false; // Prevent default form submission
            }
            return false;
        }

        // Close modals when clicking outside
        document.addEventListener('click', function(event) {
            if (event.target.classList.contains('modal-overlay')) {
                event.target.style.display = "none";
            }
        });
    </script>

    <?php
    return ob_get_clean();
}
