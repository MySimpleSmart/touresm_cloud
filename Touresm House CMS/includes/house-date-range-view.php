<?php

// Shortcode: [house_date_range_view]
add_shortcode('house_date_range_view', 'house_date_range_view_func');

function house_date_range_view_func() {
    // House size labels mapping
    $size_labels = [
        'Small' => 'Жижиг',
        'Medium' => 'Дунд',
        'Large' => 'Том'
    ];
    ob_start();

    // Include Flatpickr CSS & JS for datepickers
    echo '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">';
    echo '<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>';

    $booking_success = false;
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['submit_booking'])) {
        $checkin  = sanitize_text_field($_POST['checkin']);
        $checkout = sanitize_text_field($_POST['checkout']);
        $phone    = sanitize_text_field($_POST['phone']);
        $guests   = intval($_POST['guests']);
        $message  = sanitize_textarea_field($_POST['message']);
    }

    echo '<style>
        .date-badge {
            display: inline-block;
            padding: 2px 6px;
            margin: 2px;
            border-radius: 4px;
            font-size: 12px;
        }
        .date-badge.available {
            border: 1px solid green;
            color: green;
        }
        .date-badge.unavailable {
            border: 1px solid red;
            color: red;
        }
        #search-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        #modal-submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    </style>';

    $start_val   = isset($_GET['start_date']) ? esc_attr($_GET['start_date']) : '';
    $end_val     = isset($_GET['end_date']) ? esc_attr($_GET['end_date']) : '';
    $size_filter = isset($_GET['house_size']) ? esc_attr($_GET['house_size']) : '';

    $house_id_param = isset($_GET['house_id']) ? intval($_GET['house_id']) : 0;
    $action_book = isset($_GET['action']) && $_GET['action'] === 'book';

    // If house_id is set, only show that house and hide the search form
    if ($house_id_param) {
        echo '<!-- DEBUG: Single-house (house_id) logic triggered -->';
        $house_post = get_post($house_id_param);
        if ($house_post && $house_post->post_type === 'house') {
            $post_id = $house_id_param;
            $available_dates_raw = get_post_meta($post_id, 'available_dates', true);
            $available_dates = array_filter(array_map('trim', explode(',', $available_dates_raw)));
            $house_size = get_post_meta($post_id, 'house_size', true);
            $img_url = get_the_post_thumbnail_url($post_id, 'medium') ?: 'https://via.placeholder.com/300x200?text=No+Image';
            $full_img_url = get_the_post_thumbnail_url($post_id, 'large');
            $house_url = get_post_meta($post_id, 'house_url', true);
            $video_url = get_post_meta($post_id, 'video_url', true);
            $excerpt = strip_tags(get_the_content(null, false, $post_id));
            $excerpt_trimmed = mb_strimwidth($excerpt, 0, 80, '...');
            $gallery_ids = get_post_meta($post_id, 'house_gallery', true);
            $gallery_images = array();
            if (!empty($gallery_ids)) {
                foreach ($gallery_ids as $image_id) {
                    $img = wp_get_attachment_image_url($image_id, 'large');
                    if ($img) $gallery_images[] = $img;
                }
            }
            $slider_images = array();
            if ($img_url) $slider_images[] = $img_url;
            foreach ($gallery_images as $img) { if ($img && $img !== $img_url) $slider_images[] = $img; }
            $matched_dates = $available_dates;
            $matched_dates_json = json_encode($matched_dates);
            $available_text = implode(' ', array_map(function($d) {
                return '<span class="date-badge available">' . date('d/M', strtotime($d)) . '</span>';
            }, $matched_dates));
            $unavailable_text = '';
            $size_class = '';
            if ($house_size === 'Small') {
                $size_class = 'house-card__badge-size--small';
            } elseif ($house_size === 'Medium') {
                $size_class = 'house-card__badge-size--medium';
            } else {
                $size_class = 'house-card__badge-size--large';
            }
            ?>
            <div class="house-card-wrapper" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content:center;">
                <div class="house-card">
                    <!-- Gallery Slider on Card (with featured image first) -->
                    <div class="house-card__gallery-slider">
                      <div class="slider-container" style="position: relative; width: 100%; height: 180px; overflow: hidden; border-radius:6px;">
                        <div class="slider-wrapper" style="display: flex; transition: transform 0.3s ease;">
                          <?php foreach ($slider_images as $idx => $img) : ?>
                            <div class="slide" style="min-width:100%;height:180px;">
                              <img src="<?php echo esc_url($img); ?>" alt="Gallery Image" style="width:100%;height:100%;object-fit:cover;">
                            </div>
                          <?php endforeach; ?>
                        </div>
                        <button class="slider-nav prev" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: none; color: white; border: none; padding: 4px 12px; cursor: pointer; border-radius: 50%; z-index: 1;">❮</button>
                        <button class="slider-nav next" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; color: white; border: none; padding: 4px 12px; cursor: pointer; border-radius: 50%; z-index: 1;">❯</button>
                        <div class="slider-dots" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; z-index: 1;">
                          <?php foreach ($slider_images as $idx => $img) : ?>
                            <div class="slider-dot<?php echo $idx === 0 ? ' active' : ''; ?>" style="width:6px;height:6px;border-radius:50%;background-color:<?php echo $idx === 0 ? 'white' : 'rgba(255,255,255,0.5)'; ?>;cursor:pointer;"></div>
                          <?php endforeach; ?>
                        </div>
                      </div>
                    </div>
                    <script>
                    (function() {
                      var card = document.currentScript.parentElement;
                      var sliderWrapper = card.querySelector('.slider-wrapper');
                      var slides = card.querySelectorAll('.slide');
                      var dots = card.querySelectorAll('.slider-dot');
                      var prevBtn = card.querySelector('.slider-nav.prev');
                      var nextBtn = card.querySelector('.slider-nav.next');
                      var currentSlide = 0;
                      var totalSlides = slides.length;
                      function goToSlide(idx) {
                        currentSlide = idx;
                        sliderWrapper.style.transform = 'translateX(-' + (idx * 100) + '%)';
                        dots.forEach(function(dot, i) {
                          dot.style.backgroundColor = i === idx ? 'white' : 'rgba(255,255,255,0.5)';
                        });
                      }
                      prevBtn.onclick = function() {
                        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
                        goToSlide(currentSlide);
                      };
                      nextBtn.onclick = function() {
                        currentSlide = (currentSlide + 1) % totalSlides;
                        goToSlide(currentSlide);
                      };
                      dots.forEach(function(dot, i) {
                        dot.onclick = function() { goToSlide(i); };
                      });
                      // Touch/swipe support
                      var startX = 0;
                      var endX = 0;
                      var threshold = 30;
                      sliderWrapper.addEventListener('touchstart', function(e) {
                        if (e.touches.length === 1) {
                          startX = e.touches[0].clientX;
                        }
                      });
                      sliderWrapper.addEventListener('touchmove', function(e) {
                        if (e.touches.length === 1) {
                          endX = e.touches[0].clientX;
                        }
                      });
                      sliderWrapper.addEventListener('touchend', function(e) {
                        var diff = endX - startX;
                        if (Math.abs(diff) > threshold) {
                          if (diff < 0) {
                            currentSlide = (currentSlide + 1) % totalSlides;
                            goToSlide(currentSlide);
                          } else {
                            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
                            goToSlide(currentSlide);
                          }
                        }
                        startX = 0;
                        endX = 0;
                      });
                    })();
                    </script>
                    <!-- End Gallery Slider -->
                    <!-- House Content -->
                    <div class="house-card__content">
                      <h3 class="house-card__title"><?php echo esc_html(get_the_title($post_id)); ?></h3>
                      <div class="house-card__meta"><strong>Хэмжээ:</strong> <?php echo isset($size_labels[$house_size]) ? $size_labels[$house_size] : esc_html($house_size); ?></div>
                      <div class="house-card__meta"><strong>Боломжтой өдрүүд:</strong> <?php echo wp_kses_post($available_text); ?></div>
                      <div class="house-card__meta">
                        <strong>Боломжгүй өдрүүд:</strong>
                        <?php echo wp_kses_post($unavailable_text); ?>
                      </div>
                      <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <?php if (!empty($house_url)) : ?>
                          <a class="house-card__btn-details" href="<?php echo esc_url($house_url); ?>" target="_blank" rel="noopener" style="flex: 0.8; text-align: center; background: #aacc00; color: white; text-decoration: none; padding: 10px 0; border-radius: 4px;">Дэлгэрэнгүй</a>
                        <?php endif; ?>
                        <a class="house-card__btn-video" 
                           href="javascript:void(0);" 
                           onclick="<?php echo !empty($video_url) ? 'openVideoModal(\'' . esc_js($video_url) . '\')' : 'return false;'; ?>"
                           style="flex: 0.2; text-align: center; background: <?php echo !empty($video_url) ? '#ef233c' : '#6c757d'; ?>; color: white; text-decoration: none; padding: 10px 0; border-radius: 4px; cursor: <?php echo !empty($video_url) ? 'pointer' : 'not-allowed'; ?>;">
                          <i class="fas fa-video"></i>
                        </a>
                      </div>
                      <button
                        class="house-card__btn-booknow"
                        onclick="window.location.href='<?php echo esc_url(add_query_arg(array('house_id' => $post_id), home_url('/house-booking-confirmation/'))); ?>'"
                      >Захиалах</button>
                    </div>
                    <div class="house-card__badge-size <?php echo esc_attr($size_class); ?>">
                      <?php echo isset($size_labels[$house_size]) ? $size_labels[$house_size] : esc_html($house_size); ?>
                    </div>
                </div>
            </div>
            <?php
            // Auto-open modal if action=book
            if ($action_book) {
                echo '<script>document.addEventListener("DOMContentLoaded",function(){ setTimeout(function(){ var btn=document.getElementById("auto-book-btn"); if(btn){btn.click();}}, 400); });</script>';
            }
        } else {
            echo '<!-- DEBUG: House not found for house_id -->';
            echo '<div style="text-align:center; color:red; font-weight:bold;">House not found.</div>';
        }
        // Continue to output modal and JS at the end
    }

    ?>
    <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://touresm.cloud/wp-content/uploads/2025/06/Frame-1261155747.png" alt="Touresm" style="max-width: 80px; height: auto; display: block; margin: 0 auto; border-radius:8px;">
    </div>
    
    <form id="date-range-form" method="GET" style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <label for="start_date">Эхлэх хугацаа:</label>
        <input type="text" id="start_date" name="start_date" required value="<?php echo $start_val; ?>">
        <label for="end_date">Дуусах хугацаа:</label>
        <input type="text" id="end_date" name="end_date" required value="<?php echo $end_val; ?>">
        <label for="house_size">Хэмжээ:</label>
        <select name="house_size" id="house_size">
            <option value="">Бүгд</option>
            <option value="Large" <?php selected($size_filter, 'Large'); ?>>Том хаусууд</option>
            <option value="Medium" <?php selected($size_filter, 'Medium'); ?>>Дунд хаусууд</option>
            <option value="Small" <?php selected($size_filter, 'Small'); ?>>Жижиг хаусууд</option>
        </select>
        <span style="border: 1px solid #e9ecef; color: #dc3545; padding: 6px 10px; font-size: 12px; border-radius: 5px; display: inline-block;">
    Таны сонгосон өдрүүдийн хүрээнд сул/захиалагдсан өдрүүд харагдана. 1 өдөр шалгах бол хоёр талд нь ижил өдрийг сонгоно уу.
</span>
        <div style="display:flex; gap:10px; width:100%; flex-wrap:wrap;">
            <button type="submit" id="search-btn" style="flex:1 1 200px; background:#ef233c; color:white; border:none; padding: 12px 0; border-radius:4px; font-size: 0.95rem; font-weight: 600;">Хайх</button>
            <button type="button" id="reset-btn" style="flex:1 1 200px; background:#343a40; color:white; border:none; padding: 12px 0; border-radius:4px; font-size: 0.95rem; font-weight: 500;">Дахин эхлэх</button>
        </div>
    </form>

    <div class="house-card-wrapper" style="display: flex; flex-wrap: wrap; gap: 20px;">
    <?php
    if (!empty($start_val) && !empty($end_val)) {
        // Get current page number
        $paged = 1;
        if (get_query_var('paged')) {
            $paged = get_query_var('paged');
        } elseif (isset($_GET['paged'])) {
            $paged = intval($_GET['paged']);
        }
        
        // First get all matching posts
        $all_posts = [];
        $args = [
            'post_type'      => 'house',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
        ];
        $query = new WP_Query($args);

        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $post_id = get_the_ID();
                $available_dates_raw = get_post_meta($post_id, 'available_dates', true);
                $available_dates = array_filter(array_map('trim', explode(',', $available_dates_raw)));

                // Build requested range
                $range_dates = [];
                $start_ts = strtotime($start_val);
                $end_ts = strtotime($end_val);
                for ($d = $start_ts; $d <= $end_ts; $d = strtotime("+1 day", $d)) {
                    $range_dates[] = date('Y-m-d', $d);
                }

                // Intersection: which days in the requested range are available
                $matched_dates = array_values(array_intersect($range_dates, $available_dates));
                if (count($matched_dates) === 0) {
                    continue;
                }

                $house_size = get_post_meta($post_id, 'house_size', true);
                if ($size_filter !== '' && $house_size !== $size_filter) {
                    continue;
                }

                $all_posts[] = $post_id;
            }
        }
        wp_reset_postdata();

        // Calculate pagination
        $total_results = count($all_posts);
        $total_pages = ceil($total_results / 10);
        $offset = ($paged - 1) * 10;
        $current_page_posts = array_slice($all_posts, $offset, 10);

        if (!empty($current_page_posts)) {
            echo '
                <div style="width: 100%; margin-top: 10px;">
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                        <lord-icon
                            src="https://cdn.lordicon.com/qtpaiyhf.json"
                            trigger="loop"
                            delay="1200"
                            colors="primary:#e63946"
                            style="width:20px;height:20px;">
                        </lord-icon>
                        <span style="font-weight: bold; color: #212529;">Нийт <span style="color: #ef233c;">' . $total_results . '</span> ' . ($size_filter ? '<span style="color: #ef233c;">' . (isset($size_labels[$size_filter]) ? str_replace(['Том', 'Дунд', 'Жижиг'], ['том', 'дунд', 'жижиг'], $size_labels[$size_filter]) : strtolower($size_filter)) . '</span> ' : '') . 'илэрц олдлоо.</span>
                    </span>
                </div>
            ';

            foreach ($current_page_posts as $post_id) {
                $post = get_post($post_id);
                setup_postdata($post);
                
                $available_dates_raw = get_post_meta($post_id, 'available_dates', true);
                $available_dates = array_filter(array_map('trim', explode(',', $available_dates_raw)));

                // Build requested range
                $range_dates = [];
                $start_ts = strtotime($start_val);
                $end_ts = strtotime($end_val);
                for ($d = $start_ts; $d <= $end_ts; $d = strtotime("+1 day", $d)) {
                    $range_dates[] = date('Y-m-d', $d);
                }

                // Intersection: which days in the requested range are available
                $matched_dates = array_values(array_intersect($range_dates, $available_dates));
                $unavailable_dates = array_values(array_diff($range_dates, $available_dates));

                $house_size = get_post_meta($post_id, 'house_size', true);
                $img_url = get_the_post_thumbnail_url($post_id, 'medium') ?: 'https://via.placeholder.com/300x200?text=No+Image';
                $full_img_url = get_the_post_thumbnail_url($post_id, 'large');
                $house_url = get_post_meta($post_id, 'house_url', true);
                $video_url = get_post_meta($post_id, 'video_url', true);
                $excerpt = strip_tags(get_the_content());
                $excerpt_trimmed = mb_strimwidth($excerpt, 0, 80, '...');

                // Get gallery images
                $gallery_ids = get_post_meta($post_id, 'house_gallery', true);
                $gallery_images = array();
                if (!empty($gallery_ids)) {
                    foreach ($gallery_ids as $image_id) {
                        $img = wp_get_attachment_image_url($image_id, 'large');
                        if ($img) $gallery_images[] = $img;
                    }
                }
                $slider_images = array();
                if ($img_url) $slider_images[] = $img_url;
                foreach ($gallery_images as $img) { if ($img && $img !== $img_url) $slider_images[] = $img; }

                // Badge background based on size
                $bg_color = '#6a994e';
                if ($house_size === 'Small') {
                    $bg_color = '#06d6a0';
                } elseif ($house_size === 'Medium') {
                    $bg_color = '#ef233c';
                }

                // Prepare HTML for available/unavailable badges
                $available_text = implode(' ', array_map(function($d) {
                    return '<span class="date-badge available">' . date('d/M', strtotime($d)) . '</span>';
                }, $matched_dates));

                $unavailable_text = implode(' ', array_map(function($d) {
                    return '<span class="date-badge unavailable">' . date('d/M', strtotime($d)) . '</span>';
                }, $unavailable_dates));

                // JSON-encode the array of available dates for JS datepicker
                $matched_dates_json = json_encode($matched_dates);
                ?>
                <div class="house-card">
                  <div class="house-card__gallery-slider">
                    <?php
                    // Get gallery images
                    $gallery_ids = get_post_meta($post_id, 'house_gallery', true);
                    $gallery_images = array();
                    
                    // Add featured image as first image if it exists
                    if ($img_url) {
                        $gallery_images[] = $img_url;
                    }
                    
                    // Add gallery images
                    if (!empty($gallery_ids)) {
                        foreach ($gallery_ids as $image_id) {
                            $image_url = wp_get_attachment_image_url($image_id, 'medium_large');
                            if ($image_url) {
                                $gallery_images[] = $image_url;
                            }
                        }
                    }
                    
                    // Output gallery slides
                    foreach ($gallery_images as $index => $image_url) {
                        echo '<div class="house-card__gallery-slide" style="display: ' . ($index === 0 ? 'block' : 'none') . ';">';
                        echo '<img src="' . esc_url($image_url) . '" alt="House Image ' . ($index + 1) . '" class="house-card__image">';
                        echo '</div>';
                    }
                    ?>
                    
                    <?php if (count($gallery_images) > 1): ?>
                    <div class="house-card__gallery-nav">
                        <?php for ($i = 0; $i < count($gallery_images); $i++): ?>
                            <div class="house-card__gallery-dot <?php echo $i === 0 ? 'active' : ''; ?>" 
                                     data-index="<?php echo $i; ?>"></div>
                        <?php endfor; ?>
                    </div>
                    <button class="house-card__gallery-prev" aria-label="Previous slide">❮</button>
                    <button class="house-card__gallery-next" aria-label="Next slide">❯</button>
                    <?php endif; ?>
                  </div>
                  <!-- House Content -->
                  <div class="house-card__content">
                    <!-- Title -->
                    <h4 class="house-card__title">
                      <?php echo esc_html(get_the_title($post_id)); ?>
                    </h4>
                
                    <!-- Size -->
                    <div class="house-card__meta">
                      <strong>Хэмжээ:</strong> <?php echo isset($size_labels[$house_size]) ? $size_labels[$house_size] : esc_html($house_size); ?>
                    </div>
                
                    <!-- Available Dates Badges -->
                    <div class="house-card__meta">
                      <strong style="color: #28a745;">Сул өдрүүд:</strong>
                      <?php echo wp_kses_post($available_text); ?>
                    </div>
                
                    <!-- Unavailable Dates Badges #dc3545 -->
                    <div class="house-card__meta">
                      <strong style="color: #dc3545;">Захиалагдсан өдрүүд:</strong>
                      <?php echo wp_kses_post($unavailable_text); ?>
                    </div>
                
                    <!-- Buttons Container -->
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                      <!-- Details Button (Facebook link) -->
                      <?php if (!empty($house_url)) : ?>
                        <a class="house-card__btn-details" href="<?php echo esc_url($house_url); ?>" target="_blank" rel="noopener" style="flex: 0.8; text-align: center; background: #aacc00; color: white; text-decoration: none; padding: 10px 0; border-radius: 4px;">Дэлгэрэнгүй</a>
                      <?php endif; ?>
                      <!-- Video Button -->
                      <a class="house-card__btn-video" 
                         href="javascript:void(0);" 
                         onclick="<?php echo !empty($video_url) ? 'openVideoModal(\'' . esc_js($video_url) . '\')' : 'return false;'; ?>"
                         style="flex: 0.2; text-align: center; background: <?php echo !empty($video_url) ? '#ef233c' : '#6c757d'; ?>; color: white; text-decoration: none; padding: 10px 0; border-radius: 4px; cursor: <?php echo !empty($video_url) ? 'pointer' : 'not-allowed'; ?>;">
                        <i class="fas fa-video"></i>
                      </a>
                    </div>
                    <!-- Book Now Button -->
                    <button
                      class="house-card__btn-booknow"
                      onclick="window.location.href='<?php echo esc_url(add_query_arg(array('house_id' => $post_id), home_url('/house-booking-confirmation/'))); ?>'"
                    >Захиалах</button>
                  </div>
                
                  <!-- Corner "Size" Badge -->
                  <?php
                    // Determine badge color class based on $house_size
                    $size_class = '';
                    if ($house_size === 'Small') {
                      $size_class = 'house-card__badge-size--small';
                    } elseif ($house_size === 'Medium') {
                      $size_class = 'house-card__badge-size--medium';
                    } else {
                      $size_class = 'house-card__badge-size--large';
                    }
                  ?>
                  <div class="house-card__badge-size <?php echo esc_attr($size_class); ?>">
                    <?php echo isset($size_labels[$house_size]) ? $size_labels[$house_size] : esc_html($house_size); ?>
                  </div>
                </div>

                <?php
                wp_reset_postdata();
            }
            wp_reset_postdata();
            
            // Add pagination buttons
            if ($total_pages > 1) {
                echo '<div class="pagination-container" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; flex-wrap: wrap;">';
                
                // Previous button
                if ($paged > 1) {
                    $prev_page = $paged - 1;
                    $prev_url = add_query_arg(array(
                        'paged' => $prev_page,
                        'start_date' => $start_val,
                        'end_date' => $end_val,
                        'house_size' => $size_filter
                    ));
                    echo '<a href="' . esc_url($prev_url) . '" class="pagination-btn" style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; color: #64748b; text-decoration: none; transition: all 0.2s ease; background: white;">өмнөх</a>';
                } else {
                    echo '<span class="pagination-btn disabled" style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; color: #cbd5e1; cursor: not-allowed; background: white;">өмнөх</span>';
                }
                
                // Page numbers
                for ($i = 1; $i <= $total_pages; $i++) {
                    if ($i == $paged) {
                        echo '<span class="pagination-btn active" style="padding: 8px 16px; border: 1px solid #ef233c; border-radius: 6px; color: white; background: #ef233c; text-decoration: none;">' . $i . '</span>';
                    } else {
                        $page_url = add_query_arg(array(
                            'paged' => $i,
                            'start_date' => $start_val,
                            'end_date' => $end_val,
                            'house_size' => $size_filter
                        ));
                        echo '<a href="' . esc_url($page_url) . '" class="pagination-btn" style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; color: #64748b; text-decoration: none; transition: all 0.2s ease; background: white;">' . $i . '</a>';
                    }
                }
                
                // Next button
                if ($paged < $total_pages) {
                    $next_page = $paged + 1;
                    $next_url = add_query_arg(array(
                        'paged' => $next_page,
                        'start_date' => $start_val,
                        'end_date' => $end_val,
                        'house_size' => $size_filter
                    ));
                    echo '<a href="' . esc_url($next_url) . '" class="pagination-btn" style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; color: #64748b; text-decoration: none; transition: all 0.2s ease; background: white;">дараах</a>';
                } else {
                    echo '<span class="pagination-btn disabled" style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; color: #cbd5e1; cursor: not-allowed; background: white;">дараах</span>';
                }
                
                echo '</div>';
            }
        } else {
            echo '<p style="font-weight: bold; color: #343a40; margin-top: 10px;">
            Уучлаарай, таны хайлтад тохирох үр дүн олдсонгүй. Та өөр өдрүүд эсвэл өөр хэмжээ сонгож дахин хайна уу.
        </p>';
        }
    }
    ?>
    </div>

    <style>
        /* Pagination Styles */
        .pagination-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 20px;
            flex-wrap: wrap;
            padding: 0 10px;
        }
        
        .pagination-btn {
            padding: 8px 16px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            color: #64748b;
            text-decoration: none;
            transition: all 0.2s ease;
            background: white;
            min-width: 40px;
            text-align: center;
            font-size: 14px;
        }
        
        .pagination-btn:hover:not(.disabled):not(.active) {
            background: #f8fafc;
            border-color: #cbd5e1;
            color: #334155;
        }
        
        .pagination-btn.active {
            background: #ef233c;
            border-color: #ef233c;
            color: white;
        }
        
        .pagination-btn.disabled {
            color: #cbd5e1;
            cursor: not-allowed;
            background: #f8fafc;
        }
        
        /* Mobile Responsive Pagination */
        @media (max-width: 640px) {
            .pagination-container {
                gap: 4px;
            }
            
            .pagination-btn {
                padding: 6px 12px;
                font-size: 13px;
                min-width: 36px;
            }
        }
        
        @media (max-width: 480px) {
            .pagination-container {
                gap: 2px;
            }
            
            .pagination-btn {
                padding: 5px 10px;
                font-size: 12px;
                min-width: 32px;
            }
        }
    </style>

    <style>    
        /* ------------------------------------
           House Card Container
        ------------------------------------ */
        .house-card {
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          width: 100%;
          max-width: 300px;
          margin: 0 auto;
        }
        
        /* Hover lift effect */
        .house-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        }
        
        /* ------------------------------------
           House Card Image
        ------------------------------------ */
        .house-card__image {
          width: 100%;
          height: 180px;
          object-fit: cover;
          border-bottom: 1px solid #ececec;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-font-smoothing: subpixel-antialiased;
        }
        
        .house-card__gallery-slider img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-font-smoothing: subpixel-antialiased;
        }
        
        /* ------------------------------------
           House Card Content Area
        ------------------------------------ */
        .house-card__content {
          display: flex;
          flex-direction: column;
          padding: 16px;
          flex-grow: 1;
        }
        
        /* Title */
        .house-card__title {
          margin: 0;
          font-size: 1.1rem;
          line-height: 1.3;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
        }
        
        /* Meta info (size, availability) */
        .house-card__meta {
          font-size: 0.875rem;
          line-height: 1.4;
          color: #555;
          margin-bottom: 6px;
        }
        .house-card__meta strong {
          color: #333;
        }
        
        /* Available / Unavailable badges inside meta */
        .house-card__meta .date-badge {
          display: inline-block;
          padding: 2px 6px;
          margin: 2px 2px 0 0;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .house-card__meta .date-badge.available {
          background-color: #e6f4ea;
          border: 1px solid #28a745;
          color: #28a745;
        }
        .house-card__meta .date-badge.unavailable {
          background-color: #fdecea;
          border: 1px solid #dc3545;
          color: #dc3545;
        }
        
        /* House Size Badge (corner) */
        .house-card__badge-size {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.55rem;
          font-weight: 600;
          color: #fff;
          text-transform: uppercase;
        }
        
        /* Color variants for size badge */
        .house-card__badge-size--small {
          background-color: #a7c957;
        }
        .house-card__badge-size--medium {
          background-color: #6a994e;
        }
        .house-card__badge-size--large {
          background-color: #386641;
        }
        
        /* ------------------------------------
           "Details" Button
        ------------------------------------ */
        .house-card__btn-details {
          margin-top: auto;
          background-color: #a7c957;
          color: #fff;
          border: none;
          padding: 10px 0;
          font-size: 0.95rem;
          font-weight: 500;
          text-align: center;
          text-decoration:none !important;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          width: 100%;
        }
        .house-card__btn-details:hover {
          color: #fff;
          background-color: #6a994e;
        }
        
        .house-card__btn-booknow {
            width: 100%;
            background: #ef233c;
            color: white;
            border: none;
            padding: 15px 0;
            border-radius: 4px;
            font-size: 0.95rem;
            font-weight: 500;
            margin-top: 8px;
            cursor: pointer;
            transition: background 0.3s ease;
        }
        
        .house-card__btn-booknow:hover {
            background: #c00021;
        }
        
        /* ------------------------------------
           Responsive Adjustments
        ------------------------------------ */
        @media (max-width: 600px) {
          .house-card {
            max-width: 100%;
            margin-bottom: 20px;
          }
          .house-card__title {
            font-size: 1.1rem;
          }
        }
    </style>

    <style>
        /* Gallery Slider Styles */
        .house-card__gallery-slider {
            position: relative;
            width: 100%;
            height: 180px;
            overflow: hidden;
        }
        
        .house-card__gallery-slide {
            width: 100%;
            height: 100%;
        }
        
        .house-card__gallery-slide img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .house-card__gallery{
            background:none;
        }
        
        .house-card__gallery-prev,
        .house-card__gallery-next {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            color: white;
            width: 10px;
            height: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            z-index: 2;
            border: none;
            font-size: 24px;
            opacity: 0;
            visibility: hidden;
            text-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
            background: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
        }
        
        .house-card__gallery-slider:hover .house-card__gallery-prev,
        .house-card__gallery-slider:hover .house-card__gallery-next {
            opacity: 1;
            visibility: visible;
        }
        
        .house-card__gallery-prev {
            left: 10px;
        }
        
        .house-card__gallery-next {
            right: 10px;
        }
        
        .house-card__gallery-prev:hover,
        .house-card__gallery-next:hover {
            transform: translateY(-50%) scale(1.1);
        }
        
        .house-card__gallery-nav {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 4px;
            z-index: 2;
            padding: 4px 8px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 12px;
        }
        
        .house-card__gallery-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .house-card__gallery-dot.active {
            background: white;
            transform: scale(1.2);
        }
        
        @media (max-width: 640px) {
            .house-card__gallery-slider {
                height: 160px;
            }
            
            .house-card__gallery-prev,
            .house-card__gallery-next {
                width: 24px;
                height: 24px;
                font-size: 20px;
                opacity: 1;
                visibility: visible;
            }
            
            .house-card__gallery-nav {
                bottom: 8px;
                padding: 3px 6px;
            }
            
            .house-card__gallery-dot {
                width: 5px;
                height: 5px;
            }
        }
    </style>

    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize all house card sliders
        document.querySelectorAll('.house-card__gallery-slider').forEach(function(slider) {
            const slides = slider.querySelectorAll('.house-card__gallery-slide');
            const dots = slider.querySelectorAll('.house-card__gallery-dot');
            const prevBtn = slider.querySelector('.house-card__gallery-prev');
            const nextBtn = slider.querySelector('.house-card__gallery-next');
            let currentSlide = 0;
            let slideInterval;

            function showSlide(index) {
                // Hide all slides
                slides.forEach(slide => slide.style.display = 'none');
                // Remove active class from all dots
                dots.forEach(dot => dot.classList.remove('active'));
                
                // Show the current slide and activate its dot
                slides[index].style.display = 'block';
                dots[index].classList.add('active');
                currentSlide = index;
            }

            // Initialize first slide
            showSlide(0);

            // Add click handlers for dots
            dots.forEach((dot, index) => {
                dot.addEventListener('click', () => {
                    showSlide(index);
                    resetInterval();
                });
            });

            // Add click handlers for prev/next buttons
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
                    showSlide(currentSlide);
                    resetInterval();
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    currentSlide = (currentSlide + 1) % slides.length;
                    showSlide(currentSlide);
                    resetInterval();
                });
            }

            // Auto-advance slides
            function startInterval() {
                slideInterval = setInterval(() => {
                    currentSlide = (currentSlide + 1) % slides.length;
                    showSlide(currentSlide);
                }, 5000);
            }

            function resetInterval() {
                clearInterval(slideInterval);
                startInterval();
            }

            // Start auto-advance
            startInterval();

            // Pause on hover
            slider.addEventListener('mouseenter', () => {
                clearInterval(slideInterval);
            });

            slider.addEventListener('mouseleave', () => {
                startInterval();
            });

            // Touch support for mobile
            let touchStartX = 0;
            let touchEndX = 0;

            slider.addEventListener('touchstart', e => {
                touchStartX = e.changedTouches[0].screenX;
            }, false);

            slider.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }, false);

            function handleSwipe() {
                const swipeThreshold = 50;
                if (touchEndX < touchStartX - swipeThreshold) {
                    // Swipe left
                    currentSlide = (currentSlide + 1) % slides.length;
                    showSlide(currentSlide);
                }
                if (touchEndX > touchStartX + swipeThreshold) {
                    // Swipe right
                    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
                    showSlide(currentSlide);
                }
                resetInterval();
            }
        });
    });
    </script>

    <script>
    // Local URL Redirect
    document.addEventListener("DOMContentLoaded", function () {
        // Restore last search if no search params
        const savedUrl = localStorage.getItem("last_search_url");
        const currentParams = new URLSearchParams(window.location.search);
        if (!currentParams.has("start_date") && savedUrl) {
            window.location.href = savedUrl;
            return; // Prevent further JS running on this load
        }

        // Initialize Flatpickr on search form date fields
        flatpickr("#start_date", { 
            dateFormat: "Y-m-d",
            minDate: "today",
            onChange: function(selectedDates, dateStr) {
                checkAndAutoSearch();
            }
        });
        flatpickr("#end_date", { 
            dateFormat: "Y-m-d",
            minDate: "today",
            onChange: function(selectedDates, dateStr) {
                checkAndAutoSearch();
            }
        });

        // Add change event listener to house size dropdown
        document.getElementById('house_size').addEventListener('change', function() {
            checkAndAutoSearch();
        });

        // Function to check if both dates are selected and auto-search
        function checkAndAutoSearch() {
            const startDate = document.getElementById('start_date').value;
            const endDate = document.getElementById('end_date').value;
            const houseSize = document.getElementById('house_size').value;
            
            if (startDate && endDate) {
                // Save the full URL including paged if present
                const url = new URL(window.location.href);
                url.searchParams.set("start_date", startDate);
                url.searchParams.set("end_date", endDate);
                url.searchParams.set("house_size", houseSize);
                const paged = url.searchParams.get("paged");
                if (paged) url.searchParams.set("paged", paged);
                localStorage.setItem("last_search_url", url.toString());
                // Auto-submit the form
                document.getElementById('date-range-form').submit();
            }
        }

        document.getElementById('reset-btn').addEventListener('click', function () {
            localStorage.removeItem("last_search_url");
            let baseUrl = window.location.origin + window.location.pathname;
            baseUrl = baseUrl.replace(/\/page\/\d+\//, '/');
            baseUrl = baseUrl.replace(/\/$/, '');
            window.location.href = baseUrl;
        });

    });
    </script>

    <!-- Video Modal -->
    <div id="videoModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center;">
        <div style="position: relative; width: 90%; max-width: 800px; background: #000; border-radius: 8px; overflow: hidden;">
            <button onclick="closeVideoModal()" style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.2); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; z-index: 1001;">×</button>
            <div id="videoContainer" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
                <iframe id="videoFrame" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        </div>
    </div>

    <script>
    function openVideoModal(videoUrl) {
        // Convert YouTube URL to embed URL
        let embedUrl = videoUrl;
        if (videoUrl.includes('youtube.com/watch')) {
            const videoId = videoUrl.split('v=')[1];
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (videoUrl.includes('youtu.be/')) {
            const videoId = videoUrl.split('youtu.be/')[1];
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (videoUrl.includes('instagram.com/')) {
            // For Instagram links, open in new tab
            window.open(videoUrl, '_blank');
            return;
        } else if (videoUrl.includes('facebook.com/')) {
            // For Facebook share links, open in new tab instead of modal
            if (videoUrl.includes('/share/r/')) {
                window.open(videoUrl, '_blank');
                return;
            } else if (videoUrl.includes('videos/')) {
                // For direct video links
                const videoId = videoUrl.split('videos/')[1]?.split('/')[0];
                if (videoId) {
                    embedUrl = `https://www.facebook.com/plugins/video.php?href=https://www.facebook.com/watch?v=${videoId}&show_text=false&width=734&height=411&appId`;
                }
            } else if (videoUrl.includes('watch?v=')) {
                // For watch links
                const videoId = videoUrl.split('watch?v=')[1]?.split('&')[0];
                if (videoId) {
                    embedUrl = `https://www.facebook.com/plugins/video.php?href=https://www.facebook.com/watch?v=${videoId}&show_text=false&width=734&height=411&appId`;
                }
            }
        } else if (videoUrl.includes('fb.watch/')) {
            // For fb.watch URLs, open in new tab
            window.open(videoUrl, '_blank');
            return;
        }
        
        document.getElementById('videoFrame').src = embedUrl;
        document.getElementById('videoModal').style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    function closeVideoModal() {
        document.getElementById('videoFrame').src = ''; // Stop video
        document.getElementById('videoModal').style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }

    // Close modal when clicking outside
    document.getElementById('videoModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeVideoModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('videoModal').style.display === 'flex') {
            closeVideoModal();
        }
    });
    </script>
    <?php
    return ob_get_clean();
}

add_shortcode('booking_confirm_page', 'house_booking_confirmation_page');

function house_booking_confirmation_page() {
    ob_start();

    // House size labels mapping
    $size_labels = [
        'Small' => 'Жижиг',
        'Medium' => 'Дунд',
        'Large' => 'Том'
    ];

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['submit_booking'])) {
        $house_name = sanitize_text_field($_POST['house_name'] ?? '');
        $house_size = sanitize_text_field($_POST['house_size'] ?? '');
        $checkin    = sanitize_text_field($_POST['checkin'] ?? '');
        $checkout   = sanitize_text_field($_POST['checkout'] ?? '');
        $phone      = sanitize_text_field($_POST['phone'] ?? '');
        $guests     = sanitize_text_field($_POST['guests'] ?? '');
        $message    = sanitize_textarea_field($_POST['message'] ?? '');

        // Get house post by title
        $house_post = get_page_by_title($house_name, OBJECT, 'house');
        $house_id = $house_post ? $house_post->ID : 0;
        
        // Get house featured image
        $featured_image = $house_id ? get_the_post_thumbnail_url($house_id, 'medium') : '';
        
        // Get house rules and description
        $house_rules = $house_id ? get_post_meta($house_id, 'house_rules', true) : '';
        $house_description = $house_id ? get_the_content(null, false, $house_id) : '';

        // Get gallery images
        $gallery_ids = $house_id ? get_post_meta($house_id, 'house_gallery', true) : array();
        $gallery_images = array();
        
        // Add featured image as first image if it exists
        if ($featured_image) {
            $gallery_images[] = $featured_image;
        }
        
        // Add gallery images
        if (!empty($gallery_ids)) {
            foreach ($gallery_ids as $image_id) {
                $image_url = wp_get_attachment_image_url($image_id, 'medium_large');
                if ($image_url) {
                    $gallery_images[] = $image_url;
                }
            }
        }
        ?>
        <style>
            :root {
                --primary-color: #ef233c;
                --primary-hover: #d90429;
                --secondary-color: #64748b;
                --success-color: #10b981;
                --warning-color: #f59e0b;
                --error-color: #ef4444;
                --background: #ffffff;
                --surface: #f8fafc;
                --border: #e2e8f0;
                --text-primary: #0f172a;
                --text-secondary: #64748b;
                --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                --radius: 12px;
                --radius-lg: 16px;
            }
            
            /* Gallery Slider Styles */
            .gallery-slider {
                position: relative;
                width: 100%;
                height: 400px;
                margin-bottom: 2rem;
                border-radius: var(--radius-lg);
                overflow: hidden;
                box-shadow: var(--shadow-lg);
            }
            
            .gallery-slider img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: none;
            }
            
            .gallery-slider img.active {
                display: block;
            }
            
            .gallery-nav {
                position: absolute;
                bottom: 1rem;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 0.5rem;
                z-index: 10;
            }
            
            .gallery-nav-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .gallery-nav-dot.active {
                background: white;
                transform: scale(1.2);
            }
            
            .gallery-arrow {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(0, 0, 0, 0.5);
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                z-index: 10;
            }
            
            .gallery-arrow:hover {
                background: rgba(0, 0, 0, 0.7);
            }
            
            .gallery-arrow.prev {
                left: 0.3rem;
            }
            
            .gallery-arrow.next {
                right: 0.3rem;
            }
            
            /* Existing styles... */
            .booking-container {
                max-width: 100%;
                margin: auto;
                padding: 0.5rem;
            }
            
            .booking-content {
                display: flex;
                gap: 2rem;
                margin-bottom: 2rem;
            }
            
            .booking-left, 
            .booking-right {
                flex: 1;
            }
            
            .house-image {
                width: 100%;
                height: 300px;
                object-fit: cover;
                border-radius: var(--radius-lg);
                margin-bottom: 1.5rem;
                box-shadow: var(--shadow-lg);
                transition: transform 0.3s ease;
                border: 2px solid rgba(255, 255, 255, 0.2);
            }
            
            .house-image:hover {
                transform: scale(1.02);
            }
            
            .booking-section {
                background: var(--background);
                padding: 2rem;
                border-radius: var(--radius-lg);
                margin-bottom: 1.5rem;
                box-shadow: var(--shadow-md);
                border: 1px solid var(--border);
                position: relative;
                backdrop-filter: blur(10px);
            }
            
            .booking-section::before {
                content: '';
                position: absolute;
                left: 2rem;
                top: 0;
                width: 40px;
                height: 3px;
                background: linear-gradient(90deg, var(--primary-color), var(--primary-hover));
                border-radius: 2px;
            }
            
            .booking-section h3 {
                color: var(--text-primary);
                margin-bottom: 1.5rem;
                font-size: 1.5rem;
                font-weight: 700;
                letter-spacing: -0.025em;
            }
            
            .upload-section {
                margin-bottom: 1.5rem;
            }
            
            .information-booking {
                margin-top: 2rem;
            }
            
            .booking-title {
                font-size: 1.75rem;
                color: var(--text-primary);
                margin-bottom: 1.5rem;
                font-weight: 800;
                letter-spacing: -0.025em;
            }
            
            /* Account Section Styles */
            .account-section {
                background: linear-gradient(135deg, #f0f9fc, #e0f4f8);
                border: 2px solid #38bdf8;
                border-radius: 12px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                box-shadow: 0 4px 6px -1px rgba(14, 165, 233, 0.1);
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1.5rem;
            }
            
            .account-section p {
                margin: 0;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.7);
                border-radius: 8px;
                border: 1px solid rgba(14, 165, 233, 0.2);
                transition: all 0.2s ease;
            }
            
            .account-section p:hover {
                background: rgba(255, 255, 255, 0.9);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(14, 165, 233, 0.15);
            }
            
            .account-section p strong {
                color: #0c4a6e;
                font-size: 1rem;
                font-weight: 700;
                line-height: 1.4;
                display: block;
            }
            
            .account-section p:first-child strong::before {
                margin-right: 0.5rem;
                font-size: 1.1rem;
            }
            
            .account-section p:last-child strong::before {
                margin-right: 0.5rem;
                font-size: 1.1rem;
            }
            
            .account-number {
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 4px 0;
            }
            
            .copy-btn {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
                        
            .copy-btn:hover {
                color: #ef233c;
                background: rgba(239, 35, 60, 0.1);
            }
                        
            .copy-btn.copied {
                color: #10b981;
                background: rgba(16, 185, 129, 0.1);
            }
            
            .booking-warning-box {
                background: linear-gradient(135deg, #fef2f2, #fee2e2);
                border: 2px solid #f87171;
                border-radius: 12px;
                padding: 1.5rem;
                margin: 1.5rem 0;
                box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.1);
            }
            
            .booking-warning-box ol {
                margin: 0;
                padding-left: 1.5rem;
                counter-reset: warning-counter;
                list-style: none;
            }
            
            .booking-warning-box ol li {
                margin-bottom: 1rem;
                padding-left: 0.5rem;
                color: #7f1d1d;
                line-height: 1.6;
                position: relative;
                counter-increment: warning-counter;
            }
            
            .booking-warning-box ol li::before {
                content: counter(warning-counter);
                position: absolute;
                left: -1.5rem;
                top: 0;
                background: #ef4444;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 700;
            }
                
            .read-more-button {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
                color: white;
                padding: 0.75rem 1.5rem;
                border-radius: var(--radius);
                text-decoration: none !important;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: var(--shadow-sm);    
            }
            
            .read-more-button{
                color: white;
            }
            
            .upload-button {
                background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
                color: white;
                border: none;
                padding: 0.875rem 1.5rem;
                border-radius: var(--radius);
                cursor: pointer;
                font-size: 0.95rem;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: var(--shadow-sm);
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .upload-button::before {
                font-size: 1rem;
            }
            
            .upload-button:hover {
                background: linear-gradient(135deg, var(--primary-hover), #1e40af);
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }
            
            .remove-button {
                background: linear-gradient(135deg, var(--error-color), #dc2626);
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: var(--radius);
                margin-top: 0.75rem;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: var(--shadow-sm);
            }
            
            .remove-button:hover {
                background: linear-gradient(135deg, #dc2626, #b91c1c);
                transform: translateY(-1px);
                box-shadow: var(--shadow-md);
            }
            
            .action-buttons {
                display: flex;
                gap: 1rem;
                margin-bottom: 4rem;
            }
            
            .submit-button {
                width: 100%;
                background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
                color: white;
                border: none;
                padding: 1rem 2rem;
                border-radius: var(--radius);
                cursor: pointer;
                font-size: 1rem;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: var(--shadow-md);
                position: relative;
                overflow: hidden;
            }
            
            .submit-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: left 0.5s;
            }
            
            .submit-button:hover::before {
                left: 100%;
            }
            
            .submit-button:hover {
                background: linear-gradient(135deg, var(--primary-hover), #1e40af);
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
            }
            
            .cancel-button {
                background: var(--surface);
                color: var(--text-secondary);
                border: 2px solid var(--border);
                padding: 0.875rem 1.5rem;
                border-radius: var(--radius);
                cursor: pointer;
                font-size: 0.95rem;
                font-weight: 600;
                transition: all 0.2s ease;
            }
            
            .cancel-button:hover {
                background: var(--border);
                color: var(--text-primary);
                transform: translateY(-1px);
            }
            
            .preview-image {
                max-width: 200px;
                border-radius: var(--radius);
                margin-top: 1rem;
                box-shadow: var(--shadow-md);
                border: 2px solid var(--border);
                transition: transform 0.2s ease;
            }
            
            .preview-image:hover {
                transform: scale(1.05);
            }
            
            /* Editable Fields Styles */
            .editable-field {
                margin-bottom: 1rem;
                min-height: 40px;
                display: flex;
                flex-direction: column;
            }
            
            .editable-field label {
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: var(--text-primary);
                font-size: 0.95rem;
            }
            
            .field-text {
                padding: 0.75rem 0;
                min-height: 24px;
                color: var(--text-primary);
                background: var(--surface);
                border-radius: var(--radius);
                padding: 0.75rem 1rem;
                border: 1px solid var(--border);
            }
            
            .editable-field input,
            .editable-field textarea {
                width: 100%;
                padding: 0.875rem 1rem;
                border: 2px solid var(--border);
                border-radius: var(--radius);
                font-size: 1rem;
                line-height: 1.5;
                margin: 0;
                font-family: inherit;
                color: var(--text-primary);
                background: var(--background);
                transition: all 0.2s ease;
            }
            
            .editable-field input:focus,
            .editable-field textarea:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                transform: translateY(-1px);
            }
            
            .editable-field textarea {
                min-height: 80px;
                resize: vertical;
            }
            
            .edit-actions {
                margin-top: 1rem;
                display: flex;
                gap: 0.75rem;
                align-items: center;
            }
            
            .edit-button,
            .save-button {
                background: linear-gradient(135deg, var(--success-color), #059669);
                color: white;
                border: none;
                padding: 0.625rem 1rem;
                border-radius: var(--radius);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.875rem;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: var(--shadow-sm);
            }
            
            .edit-button:hover,
            .save-button:hover {
                background: linear-gradient(135deg, #059669, #047857);
                transform: translateY(-1px);
                box-shadow: var(--shadow-md);
            }
            
            #success-message {
                display: none;
                background: linear-gradient(135deg, #d1fae5, #a7f3d0);
                color: #065f46;
                padding: 0.75rem 1rem;
                border-radius: var(--radius);
                margin-left: 0.75rem;
                font-weight: 500;
                border-left: 3px solid var(--success-color);
                box-shadow: var(--shadow-sm);
            }
            
            #success-message::before {
                content: "✅ ";
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .booking-container {
                    padding: 0.3rem;
                }
                
                .booking-content {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .house-image {
                    height: 200px;
                }
                
                .booking-left, 
                .booking-right {
                    width: 100%;
                }
                
                .booking-section {
                    padding: 1.5rem;
                }
                
                .action-buttons {
                    flex-direction: column;
                    margin-bottom: 2rem;
                }
                
                .edit-actions {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .edit-button,
                .save-button,
                .cancel-button {
                    width: 100%;
                    justify-content: center;
                }
                
                .account-section {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                    padding: 1rem;
                }
                
                .account-section p {
                    padding: 0.75rem;
                }
                
                .account-section p strong {
                    font-size: 0.95rem;
                }
            }
            
            /* Loading States */
            .loading {
                position: relative;
                pointer-events: none;
            }
            
            .loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                margin: -10px 0 0 -10px;
                border: 2px solid transparent;
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Enhanced Animations */
            * {
                transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
            }
            
            /* Focus-visible for better accessibility */
            button:focus-visible,
            input:focus-visible,
            textarea:focus-visible {
                outline: 2px solid var(--primary-color);
                outline-offset: 2px;
            }
        </style>

        <div class="booking-container">
            <?php if (!empty($gallery_images)): ?>
                <div class="gallery-slider">
                    <?php foreach ($gallery_images as $index => $image_url): ?>
                        <img src="<?php echo esc_url($image_url); ?>" 
                             alt="House Image <?php echo $index + 1; ?>" 
                             class="<?php echo $index === 0 ? 'active' : ''; ?>">
                    <?php endforeach; ?>
                    
                    <?php if (count($gallery_images) > 1): ?>
                        <div class="gallery-nav">
                            <?php for ($i = 0; $i < count($gallery_images); $i++): ?>
                                <div class="gallery-nav-dot <?php echo $i === 0 ? 'active' : ''; ?>" 
                                     data-index="<?php echo $i; ?>"></div>
                            <?php endfor; ?>
                        </div>
                        <div class="gallery-arrow prev">
                            <i class="fas fa-chevron-left"></i>
                        </div>
                        <div class="gallery-arrow next">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <div class="booking-content">
                <div class="booking-left">
                    <div class="booking-section">
                        <h3>Сонгосон хаус: <?php echo esc_html($house_name); ?> (<?php echo isset($size_labels[$house_size]) ? $size_labels[$house_size] : esc_html($house_size); ?>)</h3>
                        <div class="editable-field">
                            <label><strong>Орох өдөр:</strong></label>
                            <span class="field-text"><?php echo esc_html($checkin); ?></span>
                            <input type="text" id="edit-checkin" name="edit_checkin" value="<?php echo esc_attr($checkin); ?>" class="datepicker" style="display: none;">
                        </div>
                        <div class="editable-field">
                            <label><strong>Гарах өдөр:</strong></label>
                            <span class="field-text"><?php echo esc_html($checkout); ?></span>
                            <input type="text" id="edit-checkout" name="edit_checkout" value="<?php echo esc_attr($checkout); ?>" class="datepicker" style="display: none;">
                        </div>
                        <?php
                        // Calculate chosen days (inclusive)
                        $days_count = 1;
                        if ($checkin && $checkout) {
                            $checkin_ts = strtotime($checkin);
                            $checkout_ts = strtotime($checkout);
                            if ($checkin_ts && $checkout_ts && $checkout_ts >= $checkin_ts) {
                                $days_count = round(($checkout_ts - $checkin_ts) / (60 * 60 * 24)) + 1;
                            }
                        }
                        ?>
                        <p><strong>Хоног:</strong> <span id="nights-count"><?php echo $days_count; ?></span></p>
                        <div class="editable-field">
                            <label><strong>Утасны дугаар:</strong></label>
                            <span class="field-text"><?php echo esc_html($phone); ?></span>
                            <input type="tel" id="edit-phone" name="edit_phone" value="<?php echo esc_attr($phone); ?>" pattern="\d{6,}" inputmode="numeric" style="display: none;">
                        </div>
                        <div class="editable-field">
                            <label><strong>Орох хүний тоо:</strong></label>
                            <span class="field-text"><?php echo esc_html($guests); ?></span>
                            <input type="number" id="edit-guests" name="edit_guests" value="<?php echo esc_attr($guests); ?>" min="1" inputmode="numeric" style="display: none;">
                        </div>
                        <div class="editable-field">
                            <label><strong>Тайлбар:</strong></label>
                            <span class="field-text"><?php echo nl2br(esc_html($message)); ?></span>
                            <textarea id="edit-message" name="edit_message" rows="3" style="display: none;"><?php echo esc_textarea($message); ?></textarea>
                        </div>
                        <div class="edit-actions">
                            <button type="button" id="edit-toggle" class="edit-button">
                                <i class="fas fa-edit"></i> Засварлах
                            </button>
                            <div style="display: flex; gap: 10px;">
                                <button type="button" id="save-edits" class="save-button" style="display: none;">
                                    <i class="fas fa-save"></i> Хадгалах
                                </button>
                                <button type="button" id="cancel-edits" class="cancel-button" style="display: none;">
                                    Цуцлах
                                </button>
                            </div>
                            <div id="success-message">
                                Амжилттай
                            </div>
                        </div>
                    </div>

                    <?php if ($house_description): ?>
                        <div class="booking-section">
                            <p><strong>Хаусны тухай:</strong><p>
                            <?php echo wp_kses_post($house_description); ?>
                            <?php 
                            $house_url = get_post_meta($house_id, 'house_url', true);
                            if ($house_url): ?>
                                <div style="margin-top: 1rem;">
                                    <a href="<?php echo esc_url($house_url); ?>" target="_blank" class="read-more-button">
                                        <i class="fas fa-external-link-alt"></i>
                                        Дэлгэрэнгүй
                                    </a>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
                    
                <div class="booking-section">
                        <h4>Урьдчилгаа хийгээд захиалгаа өгөх заавар:</h4>
                        <p><strong>Гүйлгээний УТГА:</strong></p>
                        <ul>
                          <li>Хаус ноймер,</li>
                          <li>Орох сар өдөр,</li>
                          <li>Утасны дугаар</li>
                          <li>(Жишээ: House 1, 12/31, 88880000)</li>
                        </ul>
                        
                        <div class="account-section">
                            <p><strong>Урьдчилгаа ДҮН:</strong><br>Нийт дүнгийн 30%</p>
                            <p><strong>ДАНС:</strong><br>
                                Хаанбанк<br>
                                Мөнгөнбаяр<br>
                                <span class="account-number">
                                    MN28000500
                                    <button class="copy-btn" data-copy="MN28000500" title="Copy account number">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </span>
                                <span class="account-number">
                                    5026618557
                                    <button class="copy-btn" data-copy="5026618557" title="Copy account number">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </span>
                            </p>
                        </div>


                    <script>
                        document.addEventListener('DOMContentLoaded', function() {
                            const copyButtons = document.querySelectorAll('.copy-btn');
                            
                            copyButtons.forEach(button => {
                                button.addEventListener('click', async function() {
                                    const textToCopy = this.getAttribute('data-copy');
                                    
                                    try {
                                        await navigator.clipboard.writeText(textToCopy);
                                        
                                        // Visual feedback
                                        const originalText = this.innerHTML;
                                        this.innerHTML = '<i class="fas fa-check"></i>';
                                        this.classList.add('copied');
                                        
                                        // Reset after 2 seconds
                                        setTimeout(() => {
                                            this.innerHTML = originalText;
                                            this.classList.remove('copied');
                                        }, 2000);
                                    } catch (err) {
                                        console.error('Failed to copy text: ', err);
                                    }
                                });
                            });
                        });
                    </script>
                    
                    <div class="booking-warning-box">
                        <h4>АНХААРУУЛГА:</h4>
                        <ol>
                          <li>Манайх өөр захиалгаа алдах эрсдэлдээ урьдчилгааг авч байгаа тул захиалга өгсөн түрээслэгч зүгээс захиалга өгсөнийхөө дараа захиалгаа цуцалсан, больсон нөхцөлд урьдчилгааг (удсан, удаагүйгээс үл хамаарч) огт буцаахгүй, мөн хаус солих боломжгүй хатуу нөхцөлтэйг анхаарна уу.</li>
                          <li>+21 насанд хүрсэн байх. Хүрээгүй бол орохоос гарах хүртэл дараа нь хариуцлага хүлээх эцэг эх, ангийн багш харгалзах хүнтэй заавал байх.</li>
                          <li>Орох гарах цаг: 2 цагаас ороод, маргааш нь 12 цагаас гардаг шүү.</li>
                        </ol>

                        <p><strong>Check-in:</strong> 2pm<br>
                        <strong>Check-out:</strong> 12pm</p>
                    
                        <p>(Зөвхөн #30,#42-р хаусуудын орох цаг 3pm, гарах 12pm)</p>
                    
                        <p>Тухайн өдрийн өмнөх өдөр эсвэл маргааш нь захиалгагүй байвал тогтсон цагаасаа жоохон өмнө нь ирж эсвэл дараа нь гарч болно оо :)</p>
                    </div>
                </div>
                    <br>
                    <div class="booking-section">
                    <form method="POST" enctype="multipart/form-data" id="booking-form">
                        <input type="hidden" name="house_name" value="<?php echo esc_attr($house_name); ?>">
                        <input type="hidden" name="house_size" value="<?php echo esc_attr($house_size); ?>">
                        <input type="hidden" name="checkin" value="<?php echo esc_attr($checkin); ?>">
                        <input type="hidden" name="checkout" value="<?php echo esc_attr($checkout); ?>">
                        <input type="hidden" name="phone" value="<?php echo esc_attr($phone); ?>">
                        <input type="hidden" name="guests" value="<?php echo esc_attr($guests); ?>">
                        <input type="hidden" name="message" value="<?php echo esc_attr($message); ?>">

                        <div class="upload-section">
                            <label style="display:block; margin-bottom:10px; font-weight:bold;">Гүйлгээний баримт оруулах: (Screenshot):</label>
                            <small>Гүйлгээний УТГА: Хаусын дугаар, орж буй өдөр, утасны дугаар (Жишээ: House 1, 12/31, 88880000)</small><br><br>
                            <div style="position:relative;">
                                <input type="file" name="id_image" id="id_image" accept="image/*" required style="display:none;">
                                <button type="button" onclick="document.getElementById('id_image').click()" class="upload-button" style="display: flex; align-items: center; gap: 6px;">
                                    Зураг сонгох <i class="fas fa-upload"></i>
                                </button>
                            </div>
                            <div id="image-preview" style="display:none;">
                                <img id="preview-img" src="" alt="Preview" class="preview-image">
                                <button type="button" onclick="removeImage()" class="remove-button" style="display: flex; align-items: center; gap: 6px;">
                                    Зураг устгах <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                        </div>

                        <div class="action-buttons">
                            <button type="button" onclick="confirmCancel()" class="cancel-button">
                                Цуцлах
                            </button>
                            <button type="submit" name="confirm_booking" id="confirm-booking-btn" class="submit-button" disabled style="opacity: 0.5;">
                                Баталгаажуулах <i class="fas fa-check-circle"></i>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <script>
        function previewImage(input) {
            const preview = document.getElementById('image-preview');
            const previewImg = document.getElementById('preview-img');
            const validationMessage = document.getElementById('image-validation-message');
            const confirmButton = document.getElementById('confirm-booking-btn');
            
            if (input.files && input.files[0]) {
                const file = input.files[0];
                
                // Check file size (2MB limit)
                if (file.size > 2 * 1024 * 1024) {
                    validationMessage.textContent = 'Зурагны хэмжээ 2MB-ээс бага байх ёстой.';
                    validationMessage.style.display = 'block';
                    previewImg.src = '';
                    preview.style.display = 'none';
                    confirmButton.disabled = true;
                    confirmButton.style.opacity = '0.5';
                    return;
                }

                // Check file type
                const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!validTypes.includes(file.type)) {
                    validationMessage.textContent = 'Зөвхөн JPG, JPEG, PNG зургийн форматыг зөвшөөрнө.';
                    validationMessage.style.display = 'block';
                    previewImg.src = '';
                    preview.style.display = 'none';
                    confirmButton.disabled = true;
                    confirmButton.style.opacity = '0.5';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    preview.style.display = 'block';
                    validationMessage.style.display = 'none';
                    confirmButton.disabled = false;
                    confirmButton.style.opacity = '1';
                }
                reader.readAsDataURL(file);
            } else {
                previewImg.src = '';
                preview.style.display = 'none';
                validationMessage.textContent = 'Зураг сонгох шаардлагатай.';
                validationMessage.style.display = 'block';
                confirmButton.disabled = true;
                confirmButton.style.opacity = '0.5';
            }
        }

        // Add a validation message element if not present
        if (!document.getElementById('image-validation-message')) {
            const uploadSection = document.querySelector('.upload-section');
            if (uploadSection) {
                const msg = document.createElement('div');
                msg.id = 'image-validation-message';
                msg.style.color = 'red';
                msg.style.marginTop = '8px';
                msg.style.display = 'none';
                uploadSection.insertBefore(msg, uploadSection.querySelector('#image-preview'));
            }
        }

        document.getElementById('id_image').addEventListener('change', function() {
            previewImage(this);
        });

        function removeImage() {
            const input = document.getElementById('id_image');
            const preview = document.getElementById('image-preview');
            const previewImg = document.getElementById('preview-img');
            const validationMessage = document.getElementById('image-validation-message');
            const confirmButton = document.getElementById('confirm-booking-btn');
            
            input.value = '';
            previewImg.src = '';
            preview.style.display = 'none';
            validationMessage.textContent = 'Та төлбөр төлсөн Screenshot баримтаа оруулна уу.';
            validationMessage.style.display = 'block';
            confirmButton.disabled = true;
            confirmButton.style.opacity = '0.5';
        }

        function confirmCancel() {
            if (confirm('Are you sure you want to cancel this booking?')) {
                // Simple redirect link - you can change this URL as needed
                window.location.href = '/house-search/';
            }
        }

        // Initialize Flatpickr for date fields
        document.addEventListener('DOMContentLoaded', function() {
            let originalValues = {};
            let flatpickrInstances = {};

            // Store original values
            function storeOriginalValues() {
                originalValues = {
                    checkin: document.getElementById('edit-checkin').value,
                    checkout: document.getElementById('edit-checkout').value,
                    phone: document.getElementById('edit-phone').value,
                    guests: document.getElementById('edit-guests').value,
                    message: document.getElementById('edit-message').value
                };
            }

            // Toggle between text and input fields
            function toggleFields(showInputs) {
                const fields = document.querySelectorAll('.editable-field');
                fields.forEach(field => {
                    const text = field.querySelector('.field-text');
                    const input = field.querySelector('input, textarea');
                    if (text && input) {
                        text.style.display = showInputs ? 'none' : 'block';
                        input.style.display = showInputs ? 'block' : 'none';
                    }
                });
            }

            // Initialize Flatpickr instances
            function initDatepickers() {
                // Get available dates from the house data
                const availableDates = <?php 
                    $house_post = get_page_by_title($house_name, OBJECT, 'house');
                    $available_dates_raw = $house_post ? get_post_meta($house_post->ID, 'available_dates', true) : '';
                    $available_dates = array_filter(array_map('trim', explode(',', $available_dates_raw)));
                    echo json_encode($available_dates);
                ?>;

                // Add validation message element if not present
                if (!document.getElementById('date-validation-message')) {
                    const dateFields = document.querySelector('.booking-section');
                    if (dateFields) {
                        const msg = document.createElement('div');
                        msg.id = 'date-validation-message';
                        msg.style.color = 'red';
                        msg.style.marginTop = '8px';
                        msg.style.display = 'none';
                        dateFields.appendChild(msg);
                    }
                }

                flatpickrInstances.checkin = flatpickr("#edit-checkin", {
                    dateFormat: "Y-m-d",
                    minDate: "today",
                    enable: availableDates,
                    onChange: function(selectedDates, dateStr) {
                        validateDates();
                        updateNightsCount();
                    }
                });
                
                flatpickrInstances.checkout = flatpickr("#edit-checkout", {
                    dateFormat: "Y-m-d",
                    minDate: "today",
                    enable: availableDates,
                    onChange: function(selectedDates, dateStr) {
                        validateDates();
                        updateNightsCount();
                    }
                });
            }

            // Function to validate dates
            function validateDates() {
                const checkin = document.getElementById('edit-checkin').value;
                const checkout = document.getElementById('edit-checkout').value;
                const validationMessage = document.getElementById('date-validation-message');
                const saveButton = document.getElementById('save-edits');
                
                if (!checkin || !checkout) {
                    validationMessage.textContent = 'Та шаардлагатай бүх талбарыг бөглөнө үү.';
                    validationMessage.style.display = 'block';
                    saveButton.disabled = true;
                    saveButton.style.opacity = '0.5';
                    return;
                }

                const checkinTs = Date.parse(checkin);
                const checkoutTs = Date.parse(checkout);

                if (checkoutTs < checkinTs) {
                    validationMessage.textContent = 'Гарах огноо нь орох огнооноос өмнө байх боломжгүй.';
                    validationMessage.style.display = 'block';
                    saveButton.disabled = true;
                    saveButton.style.opacity = '0.5';
                    return;
                }

                // Get available dates
                const availableDates = <?php 
                    $house_post = get_page_by_title($house_name, OBJECT, 'house');
                    $available_dates_raw = $house_post ? get_post_meta($house_post->ID, 'available_dates', true) : '';
                    $available_dates = array_filter(array_map('trim', explode(',', $available_dates_raw)));
                    echo json_encode($available_dates);
                ?>;

                let d = checkinTs;
                const oneDay = 24 * 60 * 60 * 1000;
                while (d <= checkoutTs) {
                    const isoDate = new Date(d).toISOString().slice(0,10);
                    if (!availableDates.includes(isoDate)) {
                        validationMessage.textContent = 'Уучлаарай боломжгүй. Таны сонгосон өдрүүд дунд боломжгүй өдөр багтсан байна.';
                        validationMessage.style.display = 'block';
                        saveButton.disabled = true;
                        saveButton.style.opacity = '0.5';
                        return;
                    }
                    d += oneDay;
                }

                validationMessage.style.display = 'none';
                saveButton.disabled = false;
                saveButton.style.opacity = '1';
            }

            // Function to update nights count
            function updateNightsCount() {
                const checkin = document.getElementById('edit-checkin').value;
                const checkout = document.getElementById('edit-checkout').value;
                
                if (checkin && checkout) {
                    const checkinTs = Date.parse(checkin);
                    const checkoutTs = Date.parse(checkout);
                    
                    if (checkoutTs >= checkinTs) {
                        const days = Math.round((checkoutTs - checkinTs) / (1000 * 60 * 60 * 24)) + 1;
                        document.getElementById('nights-count').textContent = days;
                    }
                }
            }

            // Toggle edit mode
            document.getElementById('edit-toggle').addEventListener('click', function() {
                // Show input fields, hide text
                toggleFields(true);
                
                // Show save and cancel buttons, hide edit button
                document.getElementById('edit-toggle').style.display = 'none';
                document.getElementById('save-edits').style.display = 'block';
                document.getElementById('cancel-edits').style.display = 'block';
                
                // Store original values
                storeOriginalValues();
                
                // Initialize datepickers
                initDatepickers();
            });

            // Cancel edits
            document.getElementById('cancel-edits').addEventListener('click', function() {
                // Restore original values
                document.getElementById('edit-checkin').value = originalValues.checkin;
                document.getElementById('edit-checkout').value = originalValues.checkout;
                document.getElementById('edit-phone').value = originalValues.phone;
                document.getElementById('edit-guests').value = originalValues.guests;
                document.getElementById('edit-message').value = originalValues.message;
                
                // Show text fields, hide inputs
                toggleFields(false);
                
                // Show edit button, hide save and cancel buttons
                document.getElementById('edit-toggle').style.display = 'block';
                document.getElementById('save-edits').style.display = 'none';
                document.getElementById('cancel-edits').style.display = 'none';
                
                // Update nights count
                updateNightsCount();
            });

            // Save edits
            document.getElementById('save-edits').addEventListener('click', function() {
                // Update hidden form fields with new values
                document.querySelector('input[name="checkin"]').value = document.getElementById('edit-checkin').value;
                document.querySelector('input[name="checkout"]').value = document.getElementById('edit-checkout').value;
                document.querySelector('input[name="phone"]').value = document.getElementById('edit-phone').value;
                document.querySelector('input[name="guests"]').value = document.getElementById('edit-guests').value;
                document.querySelector('input[name="message"]').value = document.getElementById('edit-message').value;
                
                // Update text fields with new values
                document.querySelector('.editable-field:nth-child(2) .field-text').textContent = document.getElementById('edit-checkin').value;
                document.querySelector('.editable-field:nth-child(3) .field-text').textContent = document.getElementById('edit-checkout').value;
                document.querySelector('.editable-field:nth-child(5) .field-text').textContent = document.getElementById('edit-phone').value;
                document.querySelector('.editable-field:nth-child(6) .field-text').textContent = document.getElementById('edit-guests').value;
                document.querySelector('.editable-field:nth-child(7) .field-text').textContent = document.getElementById('edit-message').value;
                
                // Show text fields, hide inputs
                toggleFields(false);
                
                // Show edit button, hide save and cancel buttons
                document.getElementById('edit-toggle').style.display = 'block';
                document.getElementById('save-edits').style.display = 'none';
                document.getElementById('cancel-edits').style.display = 'none';
                
                // Show success message
                const successMsg = document.getElementById('success-message');
                successMsg.style.display = 'block';
                
                // Hide success message after 3 seconds
                setTimeout(() => {
                    successMsg.style.display = 'none';
                }, 5000);
            });
        });
        </script>
        <?php

    } elseif (isset($_POST['confirm_booking'])) {
        if (
            isset($_FILES['id_image']) &&
            $_FILES['id_image']['error'] === UPLOAD_ERR_OK &&
            $_FILES['id_image']['size'] <= 2 * 1024 * 1024
        ) {
            $upload_dir = wp_upload_dir();
            $target_dir = trailingslashit($upload_dir['basedir']) . 'house_uploads/';
            wp_mkdir_p($target_dir);
            $filename = uniqid() . '_' . sanitize_file_name($_FILES['id_image']['name']);
            $target_file = $target_dir . $filename;

            if (move_uploaded_file($_FILES['id_image']['tmp_name'], $target_file)) {
                // Send email to admin
                $admin_email = get_option('admin_email');
                $subject = 'Шинэ захиалга - ' . $house_name;
                
                // Get house details
                $house_name = sanitize_text_field($_POST['house_name'] ?? '');
                $house_size = sanitize_text_field($_POST['house_size'] ?? '');
                $checkin = sanitize_text_field($_POST['checkin'] ?? '');
                $checkout = sanitize_text_field($_POST['checkout'] ?? '');
                $phone = sanitize_text_field($_POST['phone'] ?? '');
                $guests = sanitize_text_field($_POST['guests'] ?? '');
                $message = sanitize_textarea_field($_POST['message'] ?? '');

                // Create HTML email content
                $email_content = '
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #ff002b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
                        .detail-row { margin-bottom: 15px; }
                        .label { font-weight: bold; color: #2b2d42; }
                        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Шинэ хаус захиалга</h2>
                        </div>
                        <div class="content">
                            <div class="detail-row">
                                <span class="label">House:</span> ' . esc_html($house_name) . ' (' . esc_html($house_size) . ')
                            </div>
                            <div class="detail-row">
                                <span class="label">Check-in Date:</span> ' . esc_html($checkin) . '
                            </div>
                            <div class="detail-row">
                                <span class="label">Check-out Date:</span> ' . esc_html($checkout) . '
                            </div>
                            <div class="detail-row">
                                <span class="label">Phone Number:</span> ' . esc_html($phone) . '
                            </div>
                            <div class="detail-row">
                                <span class="label">Number of Guests:</span> ' . esc_html($guests) . '
                            </div>
                            <div class="detail-row">
                                <span class="label">Additional Message:</span><br>
                                ' . nl2br(esc_html($message)) . '
                            </div>
                        </div>
                        <div class="footer">
                            <p>This is an automated message from Touresm house booking system.</p>
                        </div>
                    </div>
                </body>
                </html>';

                // Set up email headers
                $headers = array(
                    'Content-Type: text/html; charset=UTF-8',
                    'From: ' . get_bloginfo('name') . ' <' . get_option('admin_email') . '>'
                );

                // Send the email using wp_mail
                $mail_sent = wp_mail($admin_email, $subject, $email_content, $headers, array($target_file));

                if ($mail_sent) {
                    // Save booking data to custom post type
                    $booking_post = array(
                        'post_title'    => 'Booking - ' . $house_name . ' - ' . $checkin,
                        'post_status'   => 'publish',
                        'post_type'     => 'house_booking'
                    );
                    
                    $booking_id = wp_insert_post($booking_post);
                    
                    if ($booking_id) {
                        // Save booking data as post meta
                        $booking_data = array(
                            'house_name' => $house_name,
                            'house_size' => $house_size,
                            'checkin' => $checkin,
                            'checkout' => $checkout,
                            'phone' => $phone,
                            'guests' => $guests,
                            'message' => $message,
                            'id_image' => $upload_dir['baseurl'] . '/house_uploads/' . $filename
                        );
                        
                        update_post_meta($booking_id, 'booking_data', $booking_data);
                        update_post_meta($booking_id, 'booking_status', 'pending');
                        
                        echo '<div style="max-width:600px; margin:auto; padding:20px;">
                                <div style="background:#d4edda; color:#155724; padding:15px; border-radius:4px; margin-bottom:20px;">
                                    <h3 style="margin:0 0 10px 0;">Таны захиалга илгээгдлээ.</h3>
                                    <p style="margin:0;">Таны захиалга амжилттай илгээгдлээ. Бид тун удахгүй тантай холбогдох болно. <strong>Touresm</strong></p>
                                </div>
                            </div>';
                    } else {
                        echo '<div style="max-width:600px; margin:auto; padding:20px;">
                                <div style="background:#f8d7da; color:#721c24; padding:15px; border-radius:4px;">
                                    <p style="margin:0;">Failed to save booking. Please try again.</p>
                                </div>
                            </div>';
                    }
                } else {
                    // If wp_mail fails, try to send using mail() function
                    $headers_str = "MIME-Version: 1.0\r\n";
                    $headers_str .= "Content-Type: text/html; charset=UTF-8\r\n";
                    $headers_str .= "From: " . get_bloginfo('name') . " <" . get_option('admin_email') . ">\r\n";
                    
                    $mail_sent = mail($admin_email, $subject, $email_content, $headers_str);
                    
                    if ($mail_sent) {
                        echo '<div style="max-width:600px; margin:auto; padding:20px;">
                                <div style="background:#d4edda; color:#155724; padding:15px; border-radius:4px; margin-bottom:20px;">
                                    <h3 style="margin:0 0 10px 0;">Захиалгын мэдээлэл илгээгдлээ.</h3>
                                    <p style="margin:0;">Таны захиалгын мэдээлэл амжилттай илгээгдлээ. Бид тун удахгүй танд хариу өгөх болно. Touresm</p>
                                </div>
                                <a href="' . esc_url(home_url()) . '" style="display:inline-block; background:#212529; color:white; text-decoration:none; padding:10px 20px; border-radius:4px;">
                                    Буцах
                                </a>
                            </div>';
                    } else {
                        echo '<div style="max-width:600px; margin:auto; padding:20px;">
                                <div style="background:#f8d7da; color:#721c24; padding:15px; border-radius:4px;">
                                    <p style="margin:0;">Захиалгын мэдээлэл илгээхэд алдаа гарлаа. Та дараа дахин оролдоно уу.</p>
                                </div>
                            </div>';
                    }
                }
            } else {
                echo '<div style="max-width:600px; margin:auto; padding:20px;">
                        <div style="background:#f8d7da; color:#721c24; padding:15px; border-radius:4px;">
                            <p style="margin:0;">Failed to upload image. Please try again.</p>
                        </div>
                    </div>';
            }
        } else {
            echo '<div style="max-width:600px; margin:auto; padding:20px;">
                    <div style="background:#f8d7da; color:#721c24; padding:15px; border-radius:4px;">
                        <p style="margin:0;">Please upload a valid image file (max 2MB).</p>
                    </div>
                </div>';
        }
    }

    // Gallery slider HTML and JS (self-contained)
    ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        const slider = document.querySelector('.gallery-slider');
        if (!slider) return;
        const images = slider.querySelectorAll('img');
        const dots = slider.querySelectorAll('.gallery-nav-dot');
        const prevBtn = slider.querySelector('.gallery-arrow.prev');
        const nextBtn = slider.querySelector('.gallery-arrow.next');
        let currentIndex = 0;
        function showImage(index) {
            images.forEach(img => img.classList.remove('active'));
            dots.forEach(dot => dot.classList.remove('active'));
            images[index].classList.add('active');
            dots[index].classList.add('active');
            currentIndex = index;
        }
        if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', () => {
                let newIndex = currentIndex - 1;
                if (newIndex < 0) newIndex = images.length - 1;
                showImage(newIndex);
            });
            nextBtn.addEventListener('click', () => {
                let newIndex = currentIndex + 1;
                if (newIndex >= images.length) newIndex = 0;
                showImage(newIndex);
            });
        }
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => showImage(index));
        });
        // Auto-advance slides every 5 seconds
        let autoSlide = setInterval(() => {
            let newIndex = currentIndex + 1;
            if (newIndex >= images.length) newIndex = 0;
            showImage(newIndex);
        }, 5000);
        slider.addEventListener('mouseenter', () => clearInterval(autoSlide));
        slider.addEventListener('mouseleave', () => {
            autoSlide = setInterval(() => {
                let newIndex = currentIndex + 1;
                if (newIndex >= images.length) newIndex = 0;
                showImage(newIndex);
            }, 5000);
        });
    });
    </script>
    <?php

    return ob_get_clean();
}

// Add REST endpoint for AJAX house data fetch
add_action('rest_api_init', function() {
    register_rest_route('house/v1', '/get-house', [
        'methods' => 'GET',
        'callback' => function(WP_REST_Request $request) {
            $house_id = intval($request->get_param('house_id'));
            $post = get_post($house_id);
            if (!$post || $post->post_type !== 'house') return new WP_REST_Response(['error' => 'Not found'], 404);
            $available_dates_raw = get_post_meta($house_id, 'available_dates', true);
            $available_dates = array_filter(array_map('trim', explode(',', $available_dates_raw)));
            $house_size = get_post_meta($house_id, 'house_size', true);
            return [
                'title' => get_the_title($house_id),
                'size' => $house_size,
                'available_dates' => $available_dates
            ];
        },
        'permission_callback' => '__return_true',
    ]);
});

?>