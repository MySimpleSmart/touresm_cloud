<?php
function handle_image_upload($file) {
    if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
        return array(
            'success' => false,
            'message' => 'No file was uploaded or there was an upload error.'
        );
    }

    // Check file size (2MB max)
    if ($file['size'] > 2 * 1024 * 1024) {
        return array(
            'success' => false,
            'message' => 'File size exceeds 2MB limit.'
        );
    }

    // Check file type
    $allowed_types = array('image/jpeg', 'image/jpg', 'image/png');
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime_type = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mime_type, $allowed_types)) {
        return array(
            'success' => false,
            'message' => 'Only JPG, JPEG, and PNG files are allowed.'
        );
    }

    // Create upload directory if it doesn't exist
    $upload_dir = wp_upload_dir();
    $target_dir = trailingslashit($upload_dir['basedir']) . 'house_uploads/';
    if (!wp_mkdir_p($target_dir)) {
        return array(
            'success' => false,
            'message' => 'Failed to create upload directory.'
        );
    }

    // Generate unique filename
    $filename = uniqid() . '_' . sanitize_file_name($file['name']);
    $target_file = $target_dir . $filename;

    // Move uploaded file
    if (move_uploaded_file($file['tmp_name'], $target_file)) {
        return array(
            'success' => true,
            'path' => $target_file,
            'url' => $upload_dir['baseurl'] . '/house_uploads/' . $filename
        );
    }

    return array(
        'success' => false,
        'message' => 'Failed to move uploaded file.'
    );
}

// Frontend confirmation page for house management
add_shortcode('house_booking_confirmation', 'house_management_frontend_form_confirmation_page');

function house_management_frontend_form_confirmation_page() {
    ob_start();
    ?>
    <style>
        :root {
            --primary-color: #ef233c;
            --primary-hover: #d90429;
            --secondary-color: #64748b;
            --success-color: #10b981;
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
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            min-height: 100vh;
        }
        
        .booking-container {
            max-width: 100%;
            margin: 10px;
            padding: 10px;
        }
        
        .booking-content {
            background: var(--background);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            overflow: hidden;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .featured-image-container {
            position: relative;
            overflow: hidden;
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
            margin: 0;
        }
        
        .house-image {
            width: 100%;
            height: 300px;
            object-fit: cover;
            display: block;
            transition: transform 0.3s ease;
        }
        
        .house-image:hover {
            transform: scale(1.02);
        }
        
        .booking-section {
            padding: 1rem;
            margin: 0;
            position: relative;
        }
        
        .booking-section:last-child {
            border-bottom: none;
        }
        
        .booking-section h3 {
            color: var(--text-primary);
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: -0.025em;
            margin-bottom: 0 !important;
        }
        
        .booking-section p{
            margin: 0;
        }
        
        .booking-section h4 {
            color: var(--text-primary);
            font-size: 1.125rem;
            font-weight: 600;
        }
        
        /* Warning Section Styles */
        .warning-section {
            background: linear-gradient(135deg, #fef2f2, #fee2e2);
            border: 2px solid #f87171;
            border-radius: 12px;
            padding: 1.5rem;
            margin: 1.5rem 0;
            box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.1);
        }
        
        .warning-section h4 {
            color: #dc2626;
            font-size: 1.125rem;
            font-weight: 700;
            margin: 0 0 1rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .warning-section h4::before {
            font-size: 1.2rem;
        }
        
        .warning-section ol {
            margin: 0;
            padding-left: 1.5rem;
            counter-reset: warning-counter;
            list-style: none;
        }
        
        .warning-section ol li {
            padding-left: 0.5rem;
            color: #7f1d1d;
            line-height: 1.6;
            position: relative;
            counter-increment: warning-counter;
        }
        
        .warning-section ol li::before {
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
                
        .form-group {
            margin-bottom:10px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
            font-weight: 600;
            font-size: 0.95rem;
        }
        
        .form-group input[type="text"],
        .form-group input[type="tel"],
        .form-group input[type="number"],
        .form-group input[type="date"],
        .form-group textarea {
            width: 100%;
            padding: 0.875rem 1rem;
            border: 2px solid var(--border);
            border-radius: var(--radius);
            font-size: 1rem;
            transition: all 0.2s ease;
            background: var(--background);
            color: var(--text-primary);
            font-family: inherit;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
            transform: translateY(-1px);
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .upload-section{
            margin: 1rem;
        }
        
        .upload-button {
            width:100%;
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
            align-items: center !important;
            gap: 0.5rem;
        }
        
        .upload-button:hover {
            background: linear-gradient(135deg, var(--primary-hover), #1e40af);
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }
        
        .upload-button::before {
            font-size: 1rem;
        }
        
        .preview-image {
            max-width: 100%;
            height: auto;
            margin: 1rem 0;
            border-radius: var(--radius);
            box-shadow: var(--shadow-md);
            border: 2px solid var(--border);
        }
        
        .remove-button {
            background: linear-gradient(135deg, var(--error-color), #dc2626);
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: var(--radius);
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
            margin-top: 2rem;
            padding: 2rem;
            background: var(--surface);
            border-top: 1px solid var(--border);
            justify-content: flex-end;
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
        }
        
        .read-more-button:hover{
            color: white;
        }
        
        .cancel-button:hover {
            background: var(--border);
            color: var(--text-primary);
            transform: translateY(-1px);
        }
        
        .submit-button {
            background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
            color: white;
            border: none;
            padding: 0.875rem 2rem;
            border-radius: var(--radius);
            cursor: pointer;
            font-size: 0.95rem;
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
        
        .submit-button:disabled {
            background: var(--secondary-color);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        #days-count {
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            color: var(--primary-color);
            padding: 1rem;
            border-radius: var(--radius);
            margin: 0.75rem 0;
            font-weight: 600;
            border-left: 4px solid var(--primary-color);
            font-size: 1rem;
        }
        
        #image-validation-message,
        #date-validation-message {
            color: var(--error-color);
            margin-top: 0.5rem;
            font-size: 0.875rem;
            padding: 0.5rem 0.75rem;
            background: rgba(239, 68, 68, 0.1);
            border-radius: var(--radius);
            border-left: 3px solid var(--error-color);
        }
        
        .success-message,
        .error-message {
            text-align: center;
            padding: 1.5rem;
            border-radius: var(--radius);
            margin: 1.5rem 2rem;
            font-weight: 500;
            box-shadow: var(--shadow-sm);
        }
        
        .success-message {
            background: linear-gradient(135deg, #d1fae5, #a7f3d0);
            color: #065f46;
            border-left: 4px solid var(--success-color);
        }
        
        .error-message {
            background: linear-gradient(135deg, #fee2e2, #fecaca);
            color: #991b1b;
            border-left: 4px solid var(--error-color);
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
            .booking-container {
                margin: 0;
                padding: 0;
            }
            
            .booking-section {
                padding: 1.5rem;
            }
            
            .action-buttons {
                flex-direction: column;
                padding: 1.5rem;
            }
            
            .cancel-button,
            .submit-button {
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
        
        /* Loading animation */
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
        
        /* Smooth transitions for all interactive elements */
        * {
            transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
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
            left: 1rem;
        }
        
        .gallery-arrow.next {
            right: 1rem;
        }
        
        /* Add new styles for step navigation */
        .step-navigation {
            display: flex;
            justify-content: center;
            margin-bottom: 2rem;
            gap: 1rem;
        }
        
        .step {
            padding: 0.75rem 1.5rem;
            border-radius: var(--radius);
            background: var(--surface);
            color: var(--text-secondary);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 2px solid var(--border);
        }
        
        .step.active {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }
        
        .step.completed {
            background: var(--success-color);
            color: white;
            border-color: var(--success-color);
        }
        
        .form-step {
            display: none;
        }
        
        .form-step.active {
            display: block;
        }
        
        .field-hint {
            font-weight: normal;
            font-size: 0.95rem;
            color: #666;
        }
        
        /* Flatpickr Date Picker Custom Styles */
        .flatpickr-calendar {
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            border: 1px solid #e2e8f0;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        
        .flatpickr-months {
            background: linear-gradient(135deg, #ef233c, #d90429);
            border-radius: 12px 12px 0 0;
            padding: 10px 0;
        }
        
        .flatpickr-month {
            color: white;
        }
        
        .flatpickr-current-month {
            color: white;
            font-weight: 600;
        }
        
        .flatpickr-monthDropdown-months {
            color: white;
            background: transparent;
            border: none;
        }
        
        .flatpickr-monthDropdown-months option {
            color: #333;
            background: white;
        }
        
        .flatpickr-weekdays {
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .flatpickr-weekday {
            color: #64748b;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .flatpickr-days {
            background: white;
        }
        
        .flatpickr-day {
            border-radius: 10px;
            margin: 2px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        /* Available days - GREEN */
        .flatpickr-day:not(.disabled) {
            background: #f0fdf4 !important;
            color: #166534 !important;
        }
        
        .flatpickr-day:not(.disabled):hover {
            background: #dcfce7 !important;
            color: #166534 !important;
        }
        
        /* Disabled days - RED */
        .flatpickr-day.disabled {
            background: #fef2f2 !important;
            color: #dc2626 !important;
            cursor: not-allowed !important;
        }
        
        /* Override any other flatpickr styles */
        .flatpickr-day.flatpickr-day:not(.disabled) {
            background: #f0fdf4 !important;
            color: #166534 !important;
        }
        
        .flatpickr-day.flatpickr-day.disabled {
            background: #fef2f2 !important;
            color: #dc2626 !important;
        }
        
        /* Additional selectors for enabled/disabled dates */
        .flatpickr-day.flatpickr-day:not(.flatpickr-disabled) {
            background: #f0fdf4 !important;
            color: #166534 !important;
        }
        
        .flatpickr-day.flatpickr-day.flatpickr-disabled {
            background: #fef2f2 !important;
            color: #dc2626 !important;
        }
        
        /* Month navigation arrows */
        .flatpickr-months .flatpickr-prev-month,
        .flatpickr-months .flatpickr-next-month {
            color: white;
            fill: white;
            padding: 10px;
            border-radius: 6px;
            transition: all 0.2s ease;
        }
        
        .flatpickr-months .flatpickr-prev-month:hover,
        .flatpickr-months .flatpickr-next-month:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        /* Year input styling */
        .flatpickr-current-month input.cur-year {
            color: white;
            background: transparent;
            border: none;
            font-weight: 600;
        }
        
        .flatpickr-current-month input.cur-year:focus {
            outline: none;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            padding: 2px 4px;
        }
    </style>
    <?php
    // Handle form submission first
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['confirm_booking'])) {
        // Get form data
        $house_id = isset($_POST['house_id']) ? intval($_POST['house_id']) : 0;
        $house_post = get_post($house_id);
        $house_name = $house_post ? $house_post->post_title : '';
        $house_size = get_post_meta($house_id, 'house_size', true);
        $checkin = sanitize_text_field($_POST['checkin'] ?? '');
        $checkout = sanitize_text_field($_POST['checkout'] ?? '');
        $phone = sanitize_text_field($_POST['phone'] ?? '');
        $guests = sanitize_text_field($_POST['guests'] ?? '');
        $message = sanitize_textarea_field($_POST['message'] ?? '');

        // Handle image upload
        $image_result = false;
        if (isset($_FILES['id_image']) && $_FILES['id_image']['error'] === UPLOAD_ERR_OK) {
            $image_result = handle_image_upload($_FILES['id_image']);
        }

        if ($image_result && $image_result['success']) {
            // Send email to admin
            $admin_email = 'touresmmoderator@gmail.com';
            $subject = 'Шинэ захиалга - ' . $house_name;

            // HTML email content
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
                            <span class="label">Хаус:</span> ' . esc_html($house_name) . ' (' . esc_html($house_size) . ')
                        </div>
                        <div class="detail-row">
                            <span class="label">Орох огноо:</span> ' . esc_html($checkin) . '
                        </div>
                        <div class="detail-row">
                            <span class="label">Гарах огноо:</span> ' . esc_html($checkout) . '
                        </div>
                        <div class="detail-row">
                            <span class="label">Утас:</span> ' . esc_html($phone) . '
                        </div>
                        <div class="detail-row">
                            <span class="label">Facebook нэр:</span> ' . esc_html($_POST['facebook_name'] ?? '') . '
                        </div>
                        <div class="detail-row">
                            <span class="label">Зочидын тоо:</span> ' . esc_html($guests) . '
                        </div>
                        <div class="detail-row">
                            <span class="label">Нэмэлт мэдээлэл:</span><br>
                            ' . nl2br(esc_html($message)) . '
                        </div>
                        <div class="detail-row">
                            <span class="label">Төлбөрийн баримт:</span><br>
                            <img src="' . esc_url($image_result['url']) . '" alt="Payment Screenshot" style="max-width: 100%; margin-top: 10px;">
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
                'From: ' . get_bloginfo('name') . ' <' . $admin_email . '>',
                'Reply-To: ' . $admin_email,
                'X-Mailer: PHP/' . phpversion()
            );
            
            // Debug information
            $debug_info = array(
                'admin_email' => $admin_email,
                'subject' => $subject,
                'headers' => $headers,
                'content_length' => strlen($email_content)
            );
            
            // Send the email with debugging
            add_action('wp_mail_failed', function($error) {
                error_log('Mail Error: ' . $error->get_error_message());
            });
            
            // Try to send the email
            $mail_sent = wp_mail($admin_email, $subject, $email_content, $headers);
            
            // Log the result
            error_log('Mail sending attempt - Result: ' . ($mail_sent ? 'Success' : 'Failed'));
            error_log('Debug info: ' . print_r($debug_info, true));

            // Save booking data to custom post type regardless of email status
            $booking_post = array(
                'post_title'    => 'Захиалга - ' . $house_name . ' - ' . $checkin,
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
                    'facebook_name' => sanitize_text_field($_POST['facebook_name'] ?? ''),
                    'guests' => $guests,
                    'message' => $message,
                    'id_image' => $image_result['url']
                );
                
                update_post_meta($booking_id, 'booking_data', $booking_data);
                update_post_meta($booking_id, 'booking_status', 'pending');

                echo '<div style="text-align: center; padding: 20px; background: #d4edda; color: #155724; border-radius: 4px; margin: 20px 0;">
                        <h3>Баярлалаа!</h3>
                        <p>Манай админ таны захиалгыг баталгаажсан эсэхийг шалгаад удахгүй хариу өгнө өө 🙂</p>
                      </div>';
                return ob_get_clean();
            } else {
                echo '<div style="text-align: center; padding: 20px; background: #f8d7da; color: #721c24; border-radius: 4px; margin: 20px 0;">
                        <h3>Алдаа</h3>
                        <p>Захиалга илгээдэх алдаа гарлаа. Дараа дахин оролдоно уу.</p>
                      </div>';
            }
        } else {
            echo '<div style="text-align: center; padding: 20px; background: #f8d7da; color: #721c24; border-radius: 4px; margin: 20px 0;">
                    <h3>Алдаа</h3>
                    <p>Гүйлгээний баримт оруулахад алдаа гарлаа. Дараа дахин оролдоно уу.</p>
                  </div>';
        }
    }

    // House size labels mapping
    $size_labels = [
        'Small' => 'Жижиг',
        'Medium' => 'Дунд',
        'Large' => 'Том'
    ];

    // Get house ID from URL
    $house_id = isset($_GET['house_id']) ? intval($_GET['house_id']) : 0;
    
    if ($house_id) {
        $house_post = get_post($house_id);
        if ($house_post && $house_post->post_type === 'house') {
            $house_name = $house_post->post_title;
            $house_size = get_post_meta($house_id, 'house_size', true);
            $featured_image = get_the_post_thumbnail_url($house_id, 'medium_large');
            $house_description = get_the_content(null, false, $house_id);
            $available_dates_raw = get_post_meta($house_id, 'available_dates', true);
            $available_dates = array_filter(array_map('trim', explode(',', $available_dates_raw)));
            $available_dates_json = json_encode($available_dates);
            
            // Get gallery images
            $gallery_ids = get_post_meta($house_id, 'house_gallery', true);
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
                    <form method="POST" enctype="multipart/form-data" id="booking-form" class="booking-section">
                        <input type="hidden" name="house_id" value="<?php echo esc_attr($house_id); ?>">
                        <!-- Step 1 -->
                        <div class="form-step active" id="step1">
                            <div class="booking-section">
                                <h3>Сонгосон хаус: <?php echo esc_html($house_name); ?> (<?php echo isset($size_labels[$house_size]) ? $size_labels[$house_size] : esc_html($house_size); ?>)</h3>
                            </div>

                            <?php 
                            $house_url = get_post_meta($house_id, 'house_url', true);
                            if ($house_url): ?>
                                <div class="booking-section">
                                    <a href="<?php echo esc_url($house_url); ?>" target="_blank" class="read-more-button">
                                        <i class="fas fa-external-link-alt"></i>
                                        Дэлгэрэнгүй
                                    </a>
                                </div>
                            <?php endif; ?>

                            <div class="form-group">
                                <label for="checkin">Орох өдөр:</label>
                                <input type="text" name="checkin" id="checkin" required>
                            </div>

                            <div class="form-group">
                                <label for="checkout">Гарах өдөр:</label>
                                <input type="text" name="checkout" id="checkout" required>
                            </div>

                            <div class="form-group">
                                <div id="days-count" style="display: none; margin: 8px 0; color: #d90429; background: #fff0f3; padding: 10px 12px; border-radius: 6px; font-weight: bold;">
                                    <i class="fas fa-calendar-alt"></i> <span id="days-count-text"></span>
                                </div>
                            </div>

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
                                <p><strong>Гүйлгээний УТГА:</strong><br>
                                    Хаус ноймер,<br>
                                    Орох сар өдөр,<br>
                                    Утасны дугаар<br>
                                    <em>(Жишээ: House 1, 12/31, 88880000)</em>
                                </p>
                            </div>

                            <div class="warning-section">
                                <h4>АНХААРУУЛГА:</h4>
                                <ol>
                                    <li>Манайх өөр захиалгаа алдах эрсдэлдээ урьдчилгааг авч байгаа тул захиалга өгсөн түрээслэгч зүгээс захиалга өгсөнийхөө дараа захиалгаа цуцалсан, больсон нөхцөлд урьдчилгааг (удсан, удаагүйгээс үл хамаарч) огт буцаахгүй, мөн хаус солих боломжгүй хатуу нөхцөлтэйг анхаарна уу.</li>
                                    <li>+21 насанд хүрсэн байх. Хүрээгүй бол орохоос гарах хүртэл дараа нь хариуцлага хүлээх эцэг эх, ангийн багш харгалзах хүнтэй заавал байх.</li>
                                    <li>Орох гарах цаг: 2 цагаас ороод, маргааш нь 12 цагаас гардаг шүү.</li>
                                </ol>
                                <br>
                                <p><strong>Check-in:</strong> 2pm<br>
                                <strong>Check-out:</strong> 12pm</p>
                                <br>
                                <p>(Зөвхөн #30,#42-р хаусуудын орох цаг 3pm, гарах 12pm)</p>
                                
                                <p>Тухайн өдрийн өмнөх өдөр эсвэл маргааш нь захиалгагүй байвал тогтсон цагаасаа жоохон өмнө нь ирж эсвэл дараа нь гарч болно оо :)</p>
                            </div>

                            <div class="upload-section">
                                <div style="position:relative;">
                                    <p><strong>Гүйлгээний баримт оруулах (Screenshot):</strong><br><br>
                                    <input type="file" name="id_image" id="id_image" accept="image/jpeg,image/jpg,image/png" required style="display:none;">
                                    <button type="button" onclick="document.getElementById('id_image').click()" class="upload-button" style="display: flex; align-items: center; gap: 6px;">
                                        Гүйлгээний баримт оруулах <i class="fas fa-upload"></i>
                                    </button>
                                </div>
                                <div id="image-preview" style="display:none;">
                                    <img id="preview-img" src="" alt="Preview" class="preview-image">
                                    <button type="button" onclick="removeImage()" class="remove-button" style="display: flex; align-items: center; gap: 6px;">
                                        Баримт устгах <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                                <div id="image-validation-message" style="color: red; margin-top: 8px; display: none;"></div>
                            </div>

                            <div class="action-buttons">
                                <button type="button" onclick="window.history.back()" class="cancel-button">Цуцлах</button>
                                <button type="button" onclick="nextStep()" class="submit-button">Үргэлжлүүлэх <i class="fas fa-arrow-right"></i>
</button>
                            </div>
                        </div>

                        <!-- Step 2 -->
                        <div class="form-step" id="step2">
                            <div class="form-group">
                                <label for="phone">Утасны дугаар:
                                <span class="field-hint">Та гүйлгээний утга дээр бичсэн утасны дугаараа бичиж үлдээгээрэй.</span></label>
                                <input type="tel" name="phone" id="phone" required>
                            </div>

                            <div class="form-group">
                                <label for="facebook_name">Facebook нэр:
                                <span class="field-hint">Захиалга өгсөн фэйсбүүк хаягаа оруулна уу. Баталгаажсаны дараа байршил болон хүлээж авах хүний мэдээллийг илгээнэ.</span></label>
                                <input type="text" name="facebook_name" id="facebook_name" required>
                            </div>

                            <div class="form-group">
                                <label for="guests">Орох хүний тоо:
                                <span class="field-hint">Хүний тоо нь дээш доош хэлбэлзэх бол мөн бичих.</span></label>
                                <input type="text" name="guests" id="guests" required>
                            </div>

                            <div class="form-group">
                                <label for="message">Үйл ажиллагааны мэдээлэл:
                                <span class="field-hint">Хэдэн насны хүмүүс, ямар үйл ажиллагаа тэмдэглэх эсэхээ бичиж үлдээгээрэй 😊</span></label>
                                <textarea name="message" id="message" rows="4"></textarea>
                            </div>

                            <div class="action-buttons">
                                <button type="button" onclick="prevStep()" class="cancel-button">Өмнөх</button>
                                <button type="submit" name="confirm_booking" class="submit-button">Захиалга илгээх</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <script>
            document.addEventListener('DOMContentLoaded', function() {
                // Get available dates from PHP
                const availableDates = <?php echo $available_dates_json; ?>;
                
                // Initialize Flatpickr for check-in date
                const checkinPicker = flatpickr("#checkin", {
                    dateFormat: "Y-m-d",
                    minDate: "today",
                    enable: availableDates,
                    onChange: function(selectedDates, dateStr) {
                        // Update checkout min date when check-in is selected
                        checkoutPicker.set("minDate", dateStr);
                        validateDates();
                        updateDaysCount();
                    }
                });

                // Initialize Flatpickr for check-out date
                const checkoutPicker = flatpickr("#checkout", {
                    dateFormat: "Y-m-d",
                    minDate: "today",
                    enable: availableDates,
                    onChange: function(selectedDates, dateStr) {
                        validateDates();
                        updateDaysCount();
                    }
                });
                
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

                // Function to update days count
                function updateDaysCount() {
                    const checkin = document.getElementById('checkin').value;
                    const checkout = document.getElementById('checkout').value;
                    const daysCountDiv = document.getElementById('days-count');
                    const daysCountText = document.getElementById('days-count-text');
                    
                    if (checkin && checkout) {
                        const checkinTs = Date.parse(checkin);
                        const checkoutTs = Date.parse(checkout);
                        
                        if (checkoutTs >= checkinTs) {
                            const days = Math.round((checkoutTs - checkinTs) / (1000 * 60 * 60 * 24));
                            daysCountText.textContent = `Сонгосон хоног: ${days} хоног`;
                            daysCountDiv.style.display = 'block';
                        } else {
                            daysCountDiv.style.display = 'none';
                        }
                    } else {
                        daysCountDiv.style.display = 'none';
                    }
                }

                // Add validation message element
                const formGroup = document.querySelector('.form-group');
                const validationMessage = document.createElement('div');
                validationMessage.id = 'date-validation-message';
                validationMessage.style.color = 'red';
                validationMessage.style.marginTop = '8px';
                validationMessage.style.display = 'none';
                formGroup.appendChild(validationMessage);

                // Function to validate dates
                function validateDates() {
                    const checkin = document.getElementById('checkin').value;
                    const checkout = document.getElementById('checkout').value;
                    const submitButton = document.querySelector('button[type="submit"]');
                    const validationMessage = document.getElementById('date-validation-message');

                    if (!checkin || !checkout) {
                        validationMessage.textContent = 'Та шаардлагатай бүх талбарыг бөглөнө үү.';
                        validationMessage.style.display = 'block';
                        submitButton.disabled = true;
                        submitButton.style.opacity = '0.5';
                        return;
                    }

                    const checkinTs = Date.parse(checkin);
                    const checkoutTs = Date.parse(checkout);

                    if (checkoutTs < checkinTs) {
                        validationMessage.textContent = 'Гарах огноо нь орох огнооноос өмнө байх боломжгүй.';
                        validationMessage.style.display = 'block';
                        submitButton.disabled = true;
                        submitButton.style.opacity = '0.5';
                        return;
                    }

                    // Check if all dates in range are available
                    let d = checkinTs;
                    const oneDay = 24 * 60 * 60 * 1000;
                    while (d <= checkoutTs) {
                        const isoDate = new Date(d).toISOString().slice(0,10);
                        if (!availableDates.includes(isoDate)) {
                            validationMessage.textContent = 'Уучлаарай боломжгүй. Таны сонгосон өдрүүд дунд боломжгүй өдөр багтсан байна.';
                            validationMessage.style.display = 'block';
                            submitButton.disabled = true;
                            submitButton.style.opacity = '0.5';
                            return;
                        }
                        d += oneDay;
                    }

                    // If we get here, dates are valid
                    validationMessage.style.display = 'none';
                    submitButton.disabled = false;
                    submitButton.style.opacity = '1';
                }

                // Add form submission validation
                document.querySelector('form').addEventListener('submit', function(e) {
                    const checkin = document.getElementById('checkin').value;
                    const checkout = document.getElementById('checkout').value;
                    const phone = document.getElementById('phone').value;
                    const guests = document.getElementById('guests').value;
                    const imageInput = document.getElementById('id_image');
                    
                    if (!checkin || !checkout || !phone || !guests || !imageInput.files || !imageInput.files[0]) {
                        e.preventDefault();
                        alert('Та шаардлагатай бүх талбарыг бөглөнө үү.');
                        return;
                    }

                    const checkinTs = Date.parse(checkin);
                    const checkoutTs = Date.parse(checkout);
                    
                    if (checkoutTs < checkinTs) {
                        e.preventDefault();
                        alert('Гарах огноо нь орох огнооноос өмнө байх боломжгүй.');
                        return;
                    }

                    // Check if all dates in range are available
                    let d = checkinTs;
                    const oneDay = 24 * 60 * 60 * 1000;
                    while (d <= checkoutTs) {
                        const isoDate = new Date(d).toISOString().slice(0,10);
                        if (!availableDates.includes(isoDate)) {
                            e.preventDefault();
                            alert('Уучлаарай боломжгүй. Таны сонгосон өдрүүд дунд боломжгүй өдөр багтсан байна.');
                            return;
                        }
                        d += oneDay;
                    }
                });

                // Add image preview functionality
                document.getElementById('id_image').addEventListener('change', function() {
                    previewImage(this);
                });

                // Gallery Slider functionality
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
                setInterval(() => {
                    let newIndex = currentIndex + 1;
                    if (newIndex >= images.length) newIndex = 0;
                    showImage(newIndex);
                }, 5000);
            });

            function previewImage(input) {
                const preview = document.getElementById('image-preview');
                const previewImg = document.getElementById('preview-img');
                const validationMessage = document.getElementById('image-validation-message');
                const submitButton = document.querySelector('button[type="submit"]');
                
                if (input.files && input.files[0]) {
                    const file = input.files[0];
                    
                    // Check file size (2MB limit)
                    if (file.size > 2 * 1024 * 1024) {
                        validationMessage.textContent = 'Зурагны хэмжээ 2MB-ээс бага байх ёстой.';
                        validationMessage.style.display = 'block';
                        previewImg.src = '';
                        preview.style.display = 'none';
                        submitButton.disabled = true;
                        return;
                    }

                    // Check file type
                    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
                    if (!validTypes.includes(file.type)) {
                        validationMessage.textContent = 'Зөвхөн JPG, JPEG, PNG зургийн форматыг зөвшөөрнө.';
                        validationMessage.style.display = 'block';
                        previewImg.src = '';
                        preview.style.display = 'none';
                        submitButton.disabled = true;
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = function(e) {
                        previewImg.src = e.target.result;
                        preview.style.display = 'block';
                        validationMessage.style.display = 'none';
                        submitButton.disabled = false;
                    }
                    reader.readAsDataURL(file);
                } else {
                    previewImg.src = '';
                    preview.style.display = 'none';
                    validationMessage.textContent = 'Та төлбөр төлсөн Screenshot баримтаа оруулна уу.';
                    validationMessage.style.display = 'block';
                    submitButton.disabled = true;
                }
            }

            function removeImage() {
                const imageInput = document.getElementById('id_image');
                const imagePreview = document.getElementById('image-preview');
                const previewImg = document.getElementById('preview-img');
                const validationMessage = document.getElementById('image-validation-message');
                const submitButton = document.querySelector('button[type="submit"]');

                imageInput.value = '';
                previewImg.src = '';
                imagePreview.style.display = 'none';
                validationMessage.textContent = 'Та төлбөр төлсөн Screenshot баримтаа оруулна уу.';
                validationMessage.style.display = 'block';
                submitButton.disabled = true;
            }

            // Add step navigation functions
            function nextStep() {
                // Validate step 1
                const checkin = document.getElementById('checkin').value;
                const checkout = document.getElementById('checkout').value;
                const imageInput = document.getElementById('id_image');
                
                if (!checkin || !checkout) {
                    alert('Та шаардлагатай бүх талбарыг бөглөнө үү.');
                    return;
                }
                
                if (!imageInput.files || !imageInput.files[0]) {
                    alert('Та төлбөр төлсөн Screenshot баримтаа оруулна уу.');
                    return;
                }

                // Show step 2
                document.getElementById('step1').classList.remove('active');
                document.getElementById('step2').classList.add('active');
            }

            function prevStep() {
                // Show step 1
                document.getElementById('step2').classList.remove('active');
                document.getElementById('step1').classList.add('active');
            }
            </script>
            <?php
            return ob_get_clean();
        }
    }

    return ob_get_clean();
} 