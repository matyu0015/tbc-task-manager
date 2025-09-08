(function() {
    'use strict';
    
    console.log('Enhanced debug calendar script loaded');

    let calendar;
    let allTasks = [];
    let detectedFields = {};
    let fieldDetectionComplete = false;

    // ビュー表示時の処理
    kintone.events.on('app.record.index.show', function(event) {
        console.log('View loaded:', event.viewName);
        
        if (event.viewName !== 'カレンダー表示') {
            return event;
        }

        setTimeout(function() {
            performComprehensiveFieldDetection();
        }, 1000);
        
        return event;
    });

    function performComprehensiveFieldDetection() {
        console.log('=== 包括的フィールド検出開始 ===');
        
        // フィールド情報を取得
        kintone.api('/k/v1/app/form/fields', 'GET', {
            app: kintone.app.getId()
        }).then(function(response) {
            console.log('=== 実際のアプリフィールド情報 ===');
            console.log('Total fields found:', Object.keys(response.properties).length);
            
            // 全フィールドを詳細ログ出力
            Object.keys(response.properties).forEach(fieldCode => {
                const field = response.properties[fieldCode];
                console.log(`フィールド: ${fieldCode} | タイプ: ${field.type} | ラベル: "${field.label}"`);
            });
            
            // 複数の検出戦略を実行
            detectedFields = detectFieldsWithMultipleStrategies(response.properties);
            
            console.log('=== 最終検出結果 ===');
            console.log(detectedFields);
            
            // 検出結果の検証
            validateDetectedFields();
            
            fieldDetectionComplete = true;
            initializeCalendar();
            
        }).catch(function(error) {
            console.error('フィールド取得に失敗:', error);
            
            // フォールバック戦略
            console.log('=== フォールバック戦略実行 ===');
            detectedFields = {
                TASK_NAME: 'タスク名',
                PROJECT_NAME: '案件名',
                START_DATE: '開始日時',
                END_DATE: '終了日時', 
                TASK_TYPE: 'タスク種別',
                STATUS: 'ステータス',
                DESCRIPTION: '説明'
            };
            
            console.log('フォールバックフィールド:', detectedFields);
            fieldDetectionComplete = true;
            initializeCalendar();
        });
    }

    function detectFieldsWithMultipleStrategies(fields) {
        const result = {};
        
        // 戦略1: 完全一致
        console.log('--- 戦略1: 完全一致検索 ---');
        const exactMatches = {
            'task_name': 'TASK_NAME',
            'project_name': 'PROJECT_NAME', 
            'start_date': 'START_DATE',
            'end_date': 'END_DATE',
            'task_type': 'TASK_TYPE',
            'status': 'STATUS',
            'description': 'DESCRIPTION'
        };
        
        Object.keys(fields).forEach(fieldCode => {
            if (exactMatches[fieldCode]) {
                result[exactMatches[fieldCode]] = fieldCode;
                console.log(`完全一致: ${exactMatches[fieldCode]} = ${fieldCode}`);
            }
        });
        
        // 戦略2: 日本語ラベル一致
        console.log('--- 戦略2: 日本語ラベル一致 ---');
        Object.keys(fields).forEach(fieldCode => {
            const field = fields[fieldCode];
            const label = field.label;
            
            if (label === 'タスク名' && !result.TASK_NAME) {
                result.TASK_NAME = fieldCode;
                console.log(`ラベル一致: TASK_NAME = ${fieldCode} (${label})`);
            }
            if (label === '案件名' && !result.PROJECT_NAME) {
                result.PROJECT_NAME = fieldCode;
                console.log(`ラベル一致: PROJECT_NAME = ${fieldCode} (${label})`);
            }
            if ((label === '開始日時' || label === '開始日') && !result.START_DATE) {
                result.START_DATE = fieldCode;
                console.log(`ラベル一致: START_DATE = ${fieldCode} (${label})`);
            }
            if ((label === '終了日時' || label === '終了日') && !result.END_DATE) {
                result.END_DATE = fieldCode;
                console.log(`ラベル一致: END_DATE = ${fieldCode} (${label})`);
            }
            if ((label === 'タスク種別' || label === 'タスクタイプ') && !result.TASK_TYPE) {
                result.TASK_TYPE = fieldCode;
                console.log(`ラベル一致: TASK_TYPE = ${fieldCode} (${label})`);
            }
            if (label === 'ステータス' && !result.STATUS) {
                result.STATUS = fieldCode;
                console.log(`ラベル一致: STATUS = ${fieldCode} (${label})`);
            }
            if ((label === '説明' || label === '作業内容') && !result.DESCRIPTION) {
                result.DESCRIPTION = fieldCode;
                console.log(`ラベル一致: DESCRIPTION = ${fieldCode} (${label})`);
            }
        });
        
        // 戦略3: 部分一致（未検出のフィールドのみ）
        console.log('--- 戦略3: 部分一致検索 ---');
        Object.keys(fields).forEach(fieldCode => {
            const field = fields[fieldCode];
            const label = field.label.toLowerCase();
            const code = fieldCode.toLowerCase();
            
            if (!result.TASK_NAME && (label.includes('タスク') || label.includes('名前') || code.includes('task') || code.includes('name'))) {
                result.TASK_NAME = fieldCode;
                console.log(`部分一致: TASK_NAME = ${fieldCode} (${field.label})`);
            }
            if (!result.PROJECT_NAME && (label.includes('案件') || label.includes('プロジェクト') || code.includes('project'))) {
                result.PROJECT_NAME = fieldCode;
                console.log(`部分一致: PROJECT_NAME = ${fieldCode} (${field.label})`);
            }
            if (!result.START_DATE && (label.includes('開始') || label.includes('日時') || code.includes('start') || code.includes('date'))) {
                result.START_DATE = fieldCode;
                console.log(`部分一致: START_DATE = ${fieldCode} (${field.label})`);
            }
            if (!result.END_DATE && (label.includes('終了') || code.includes('end'))) {
                result.END_DATE = fieldCode;
                console.log(`部分一致: END_DATE = ${fieldCode} (${field.label})`);
            }
            if (!result.TASK_TYPE && (label.includes('種別') || label.includes('タイプ') || code.includes('type'))) {
                result.TASK_TYPE = fieldCode;
                console.log(`部分一致: TASK_TYPE = ${fieldCode} (${field.label})`);
            }
            if (!result.STATUS && (label.includes('ステータス') || label.includes('状態') || code.includes('status'))) {
                result.STATUS = fieldCode;
                console.log(`部分一致: STATUS = ${fieldCode} (${field.label})`);
            }
            if (!result.DESCRIPTION && (label.includes('説明') || label.includes('内容') || code.includes('description') || code.includes('desc'))) {
                result.DESCRIPTION = fieldCode;
                console.log(`部分一致: DESCRIPTION = ${fieldCode} (${field.label})`);
            }
        });
        
        return result;
    }

    function validateDetectedFields() {
        console.log('=== フィールド検出結果の検証 ===');
        
        const requiredFields = ['TASK_NAME', 'PROJECT_NAME', 'START_DATE', 'STATUS'];
        const missingFields = [];
        
        requiredFields.forEach(field => {
            if (!detectedFields[field]) {
                missingFields.push(field);
                console.error(`❌ 必須フィールド未検出: ${field}`);
            } else {
                console.log(`✅ 検出済み: ${field} = ${detectedFields[field]}`);
            }
        });
        
        if (missingFields.length > 0) {
            console.error('⚠️ 不足フィールドあり:', missingFields);
            return false;
        }
        
        console.log('✅ 全必須フィールド検出完了');
        return true;
    }

    function initializeCalendar() {
        if (!fieldDetectionComplete) {
            console.log('フィールド検出未完了のため初期化をスキップ');
            return;
        }
        
        console.log('カレンダー初期化開始');
        
        const headerSpace = kintone.app.getHeaderSpaceElement();
        if (!headerSpace) {
            console.error('Header space not found');
            return;
        }

        // デバッグ情報は開発者のみ表示（本番では非表示）
        const debugMode = localStorage.getItem('kintone-debug-mode') === 'true';
        
        const debugInfo = debugMode ? `
            <div id="enhanced-debug-info" style="background: #d4edda; padding: 15px; margin: 10px 0; border-radius: 8px; border: 1px solid #c3e6cb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #155724;">🔍 開発者モード</strong>
                    <div>
                        <button onclick="showComprehensiveDebug()" class="btn btn-sm btn-info" style="margin-right: 5px;">詳細情報</button>
                        <button onclick="testAllFields()" class="btn btn-sm btn-warning" style="margin-right: 5px;">フィールドテスト</button>
                        <button onclick="performSafeTest()" class="btn btn-sm btn-success">テスト</button>
                    </div>
                </div>
                <div id="comprehensive-debug" style="display: none; margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 11px; max-height: 200px; overflow-y: auto;"></div>
            </div>
        ` : '';
        
        headerSpace.innerHTML = `
            ${debugInfo}
            
            <div id="calendar-app">
                <div class="calendar-header">
                    <h2>📅 タスクカレンダー</h2>
                    <div class="header-actions">
                        <button type="button" id="bg-settings-btn" class="btn btn-warning">🖼️ 背景設定</button>
                        <button type="button" id="project-mgmt-btn" class="btn btn-info">📁 案件管理</button>
                        <button type="button" id="add-task-btn" class="btn btn-success">+ 新規タスク</button>
                    </div>
                </div>
                <div class="calendar-controls">
                    <select id="project-filter">
                        <option value="">全案件</option>
                    </select>
                    <button type="button" id="refresh-btn" class="btn btn-primary">🔄 更新</button>
                </div>
                <div class="calendar-layout">
                    <div class="calendar-sidebar left-sidebar">
                        <div class="sidebar-background" id="left-bg"></div>
                        <div class="sidebar-content">
                            <h4>📈 今日のタスク</h4>
                            <div id="today-summary"></div>
                        </div>
                    </div>
                    <div id="calendar-container"></div>
                    <div class="calendar-sidebar right-sidebar">
                        <div class="sidebar-background" id="right-bg"></div>
                        <div class="sidebar-content">
                            <h4>📝 メモ</h4>
                            <textarea id="daily-memo" placeholder="今日のメモ..."></textarea>
                            <button type="button" id="save-memo-btn" class="btn btn-sm">保存</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        addCalendarStyles();
        
        loadFullCalendar().then(function() {
            setupCalendar();
            setupAllEventListeners();
            loadAllTasks();
            applyStoredBackgrounds();
        });
    }

    function addCalendarStyles() {
        if (document.getElementById('enhanced-calendar-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'enhanced-calendar-styles';
        style.textContent = `
            #calendar-app {
                margin: 20px 0;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            
            .calendar-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .calendar-header h2 {
                margin: 0;
                font-size: 24px;
            }
            
            .header-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .calendar-controls {
                padding: 15px 20px;
                background: #f8f9fa;
                display: flex;
                gap: 15px;
                align-items: center;
            }
            
            .calendar-layout {
                display: flex;
                gap: 20px;
                min-height: 600px;
                padding: 20px;
            }
            
            .calendar-sidebar {
                width: 200px;
                position: relative;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid #e9ecef;
            }
            
            .sidebar-background {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-size: cover;
                background-position: center;
                opacity: 0.3;
            }
            
            .sidebar-content {
                position: relative;
                z-index: 2;
                padding: 15px;
                background: rgba(255,255,255,0.9);
                height: 100%;
                box-sizing: border-box;
            }
            
            .sidebar-content h4 {
                margin: 0 0 10px 0;
                font-size: 14px;
                color: #333;
                text-align: center;
            }
            
            #calendar-container {
                flex: 1;
                min-height: 500px;
            }
            
            #daily-memo {
                width: 100%;
                height: 80px;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
                resize: vertical;
                box-sizing: border-box;
            }
            
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                text-decoration: none;
                display: inline-block;
            }
            
            .btn-primary { background: #007bff; color: white; }
            .btn-success { background: #28a745; color: white; }
            .btn-info { background: #17a2b8; color: white; }
            .btn-warning { background: #ffc107; color: #212529; }
            .btn-danger { background: #dc3545; color: white; }
            .btn-secondary { background: #6c757d; color: white; }
            .btn-sm { padding: 4px 8px; font-size: 12px; }
            
            .task-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .modal-content {
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                color: #333;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .modal-footer {
                padding: 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
                color: #333;
            }
            
            .form-group input,
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 4px;
                color: white;
                font-weight: bold;
                z-index: 10001;
            }
            
            .notification.success { background: #28a745; }
            .notification.error { background: #dc3545; }
            .notification.warning { background: #ffc107; color: #212529; }
            
            .img-preview {
                width: 100%;
                height: 60px;
                border: 2px dashed #ddd;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: #666;
                margin: 8px 0;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
        `;
        
        document.head.appendChild(style);
    }

    function loadFullCalendar() {
        return new Promise(function(resolve) {
            if (window.FullCalendar) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.js';
            script.onload = resolve;
            script.onerror = function() {
                console.error('FullCalendar loading failed');
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    function setupCalendar() {
        const calendarEl = document.getElementById('calendar-container');
        if (!calendarEl) {
            console.error('Calendar container not found');
            return;
        }

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ja',
            height: 'auto',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true,
            selectable: true,
            dateClick: function(info) {
                console.log('Date clicked:', info.dateStr);
                openTaskDialog(info.date);
            },
            eventClick: function(info) {
                const recordId = info.event.id;
                const url = `${location.origin}/k/${kintone.app.getId()}/show#record=${recordId}`;
                window.open(url, '_blank');
            },
            eventDrop: function(info) {
                updateTaskDate(info.event.id, info.event.start);
            }
        });

        calendar.render();
        console.log('Calendar rendered successfully');
    }

    function setupAllEventListeners() {
        console.log('Setting up all event listeners...');
        
        // 背景設定ボタン
        const bgBtn = document.getElementById('bg-settings-btn');
        if (bgBtn) {
            bgBtn.onclick = function() {
                console.log('Background button clicked');
                openBackgroundDialog();
            };
        }
        
        // 案件管理ボタン
        const projectBtn = document.getElementById('project-mgmt-btn');
        if (projectBtn) {
            projectBtn.onclick = function() {
                console.log('Project button clicked');
                openProjectDialog();
            };
        }
        
        // 新規タスクボタン
        const addBtn = document.getElementById('add-task-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                openTaskDialog(new Date());
            };
        }
        
        // 更新ボタン
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = function() {
                loadAllTasks();
            };
        }
        
        // メモ保存ボタン
        const memoBtn = document.getElementById('save-memo-btn');
        if (memoBtn) {
            memoBtn.onclick = function() {
                saveMemo();
            };
        }
    }

    function openProjectDialog() {
        console.log('Opening enhanced project dialog...');
        
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📁 案件管理</h3>
                    <button type="button" class="close-btn" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    
                    <div class="form-group">
                        <label>新規案件名:</label>
                        <input type="text" id="new-project-input" placeholder="例: Webサイト制作">
                    </div>
                    <div class="form-group">
                        <button type="button" onclick="addProjectSafely()" class="btn btn-primary">案件を追加</button>
                    </div>
                    
                    <div class="existing-projects">
                        <h4>既存案件:</h4>
                        <div id="projects-list-enhanced">読み込み中...</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal(this)" class="btn btn-secondary">閉じる</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        loadExistingProjectsEnhanced();
    }

    function addProjectSafely() {
        const projectName = document.getElementById('new-project-input').value.trim();
        
        if (!projectName) {
            alert('案件名を入力してください');
            return;
        }
        
        console.log('=== 安全な案件追加開始 ===');
        console.log('案件名:', projectName);
        console.log('使用予定フィールド:', detectedFields);
        
        // フィールド存在確認
        if (!detectedFields.PROJECT_NAME || !detectedFields.TASK_NAME) {
            showNotification('エラー: 必要なフィールドが検出されていません', 'error');
            return;
        }
        
        // 最小限のレコード構造（タスク名と案件名のみ）
        const record = {};
        record[detectedFields.TASK_NAME] = { value: `${projectName}` };
        record[detectedFields.PROJECT_NAME] = { value: projectName };
        
        console.log('作成予定レコード:', record);
        
        // レコード作成前の最終検証
        kintone.api('/k/v1/app/form/fields', 'GET', {
            app: kintone.app.getId()
        }).then(function(fieldsResponse) {
            console.log('=== 作成直前フィールド検証 ===');
            
            const actualFieldCodes = Object.keys(fieldsResponse.properties);
            console.log('実際のフィールドコード一覧:', actualFieldCodes);
            
            // 使用予定フィールドの存在確認
            let allFieldsExist = true;
            Object.keys(record).forEach(fieldCode => {
                if (!actualFieldCodes.includes(fieldCode)) {
                    console.error(`❌ フィールドが存在しません: ${fieldCode}`);
                    allFieldsExist = false;
                } else {
                    console.log(`✅ フィールド確認OK: ${fieldCode}`);
                }
            });
            
            if (!allFieldsExist) {
                showNotification('エラー: 一部フィールドが存在しません。コンソールを確認してください。', 'error');
                return;
            }
            
            // レコード作成実行
            return kintone.api('/k/v1/record', 'POST', {
                app: kintone.app.getId(),
                record: record
            });
            
        }).then(function(response) {
            if (response) {
                console.log('案件作成成功:', response);
                
                document.getElementById('new-project-input').value = '';
                showNotification(`案件「${projectName}」を追加しました`, 'success');
                
                loadExistingProjectsEnhanced();
                loadAllTasks();
            }
        }).catch(function(error) {
            console.error('=== 案件作成エラー ===');
            console.error('エラー詳細:', error);
            console.error('使用したレコード:', record);
            console.error('使用したフィールドマッピング:', detectedFields);
            
            showNotification('案件追加に失敗: ' + error.message, 'error');
        });
    }

    function loadExistingProjectsEnhanced() {
        if (!detectedFields.PROJECT_NAME) {
            console.error('PROJECT_NAME field not detected');
            const container = document.getElementById('projects-list-enhanced');
            if (container) {
                container.innerHTML = '<p style="color: red;">エラー: 案件名フィールドが検出されていません</p>';
            }
            return;
        }
        
        console.log('既存案件を安全に読み込み中...');
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${detectedFields.PROJECT_NAME} != "" order by ${detectedFields.PROJECT_NAME} asc`
        }).then(function(response) {
            console.log('既存案件レコード取得:', response.records.length);
            
            const projects = [...new Set(response.records.map(r => {
                const projectField = r[detectedFields.PROJECT_NAME];
                return projectField ? projectField.value : null;
            }).filter(p => p))];
            
            console.log('ユニーク案件一覧:', projects);
            
            const container = document.getElementById('projects-list-enhanced');
            if (container) {
                if (projects.length === 0) {
                    container.innerHTML = '<p style="color: #666;">まだ案件がありません</p>';
                } else {
                    container.innerHTML = projects.map(p => 
                        `<div style="padding: 8px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; margin-bottom: 5px;">${p}</div>`
                    ).join('');
                }
            }
        }).catch(function(error) {
            console.error('既存案件読み込みエラー:', error);
            const container = document.getElementById('projects-list-enhanced');
            if (container) {
                container.innerHTML = '<p style="color: red;">読み込みエラー: ' + error.message + '</p>';
            }
        });
    }

    function openTaskDialog(date, existingTask = null) {
        console.log('タスクダイアログを安全に開いています...');
        console.log('検出フィールド:', detectedFields);
        
        const isEdit = !!existingTask;
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${isEdit ? 'タスク編集' : '新規タスク作成'}</h3>
                    <button type="button" class="close-btn" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    
                    <form id="task-form">
                        <div class="form-group">
                            <label>タスク名 *</label>
                            <input type="text" id="task-name-input" required 
                                   value="${isEdit ? existingTask.title : ''}" 
                                   placeholder="例: 資料作成">
                        </div>
                        
                        <div class="form-group">
                            <label>案件名 *</label>
                            <select id="project-select" required>
                                <option value="">読み込み中...</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>作業内容</label>
                            <textarea id="task-desc" placeholder="作業の詳細を入力...">${isEdit ? (existingTask.extendedProps.description || '') : ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>開始日時 *</label>
                            <input type="datetime-local" id="start-datetime" required
                                   value="${formatDateForInput(isEdit ? existingTask.start : date)}">
                        </div>
                        
                        <div class="form-group">
                            <label>終了日時</label>
                            <input type="datetime-local" id="end-datetime"
                                   value="${isEdit && existingTask.end ? formatDateForInput(existingTask.end) : ''}">
                        </div>
                        
                        <div class="form-group">
                            <label>タスク種別 *</label>
                            <select id="task-type-select" required>
                                <option value="単発">単発</option>
                                <option value="デイリー">デイリー</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>ステータス *</label>
                            <select id="status-select" required>
                                <option value="未着手">未着手</option>
                                <option value="進行中">進行中</option>
                                <option value="完了">完了</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal(this)" class="btn btn-secondary">キャンセル</button>
                    <button type="button" onclick="saveTaskSafely(${isEdit ? `'${existingTask.id}'` : 'null'})" class="btn btn-primary">${isEdit ? '更新' : '作成'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        loadProjectOptionsForTaskSafely(isEdit ? existingTask.extendedProps.project : null);
        
        setTimeout(function() {
            document.getElementById('task-name-input').focus();
        }, 100);
    }

    function loadProjectOptionsForTaskSafely(selectedProject = null) {
        const select = document.getElementById('project-select');
        if (!select) return;
        
        console.log('案件オプションを安全に読み込み中...');
        
        if (!detectedFields.PROJECT_NAME) {
            select.innerHTML = '<option value="">エラー: 案件フィールド未検出</option>';
            return;
        }
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${detectedFields.PROJECT_NAME} != "" order by ${detectedFields.PROJECT_NAME} asc`
        }).then(function(response) {
            console.log('案件データ取得成功:', response.records.length);
            
            const projects = [...new Set(response.records.map(task => {
                const projectField = task[detectedFields.PROJECT_NAME];
                return projectField ? projectField.value : null;
            }).filter(p => p))];
            
            console.log('利用可能案件:', projects);
            
            select.innerHTML = '<option value="">案件を選択</option>';
            projects.forEach(function(project) {
                const option = document.createElement('option');
                option.value = project;
                option.textContent = project;
                if (project === selectedProject) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            console.log('案件ドロップダウン更新完了');
            
        }).catch(function(error) {
            console.error('案件読み込みエラー:', error);
            select.innerHTML = '<option value="">エラー: 案件読み込み失敗</option>';
        });
    }

    function loadAllTasks() {
        console.log('全タスクを安全に読み込み中...');
        
        if (!detectedFields.START_DATE) {
            console.error('START_DATE field not detected - cannot load tasks');
            return;
        }
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `order by $id desc limit 100`
        }).then(function(response) {
            console.log('タスク読み込み成功:', response.records.length);
            allTasks = response.records;
            updateProjectFilter();
            displayTasksOnCalendar();
        }).catch(function(error) {
            console.error('タスク読み込みエラー:', error);
            showNotification('タスク読み込みに失敗しました', 'error');
        });
    }

    function updateProjectFilter() {
        const select = document.getElementById('project-filter');
        if (!select || !detectedFields.PROJECT_NAME) return;
        
        const projects = [...new Set(allTasks.map(task => {
            const projectField = task[detectedFields.PROJECT_NAME];
            return projectField ? projectField.value : null;
        }).filter(p => p))];
        
        select.innerHTML = '<option value="">全案件</option>';
        projects.forEach(function(project) {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            select.appendChild(option);
        });
    }

    function displayTasksOnCalendar() {
        if (!calendar || !detectedFields.TASK_NAME) return;
        
        calendar.removeAllEvents();
        
        const events = allTasks.filter(task => {
            // 開始日時があるタスクのみ表示
            const startField = task[detectedFields.START_DATE];
            return startField && startField.value;
        }).map(function(task) {
            const taskNameField = task[detectedFields.TASK_NAME];
            const projectField = task[detectedFields.PROJECT_NAME];
            const startField = task[detectedFields.START_DATE];
            const endField = task[detectedFields.END_DATE];
            const statusField = task[detectedFields.STATUS];
            
            const projectName = projectField ? projectField.value : '未分類';
            const projectColor = getProjectColor(projectName);
            
            return {
                id: task.$id.value,
                title: taskNameField ? taskNameField.value : 'タスク',
                start: startField.value,
                end: endField ? endField.value : null,
                backgroundColor: projectColor,
                borderColor: projectColor,
                extendedProps: {
                    status: statusField ? statusField.value : '未着手',
                    project: projectName,
                    description: task[detectedFields.DESCRIPTION] ? task[detectedFields.DESCRIPTION].value : ''
                }
            };
        });
        
        console.log('カレンダーに表示するイベント数:', events.length);
        calendar.addEventSource(events);
    }

    function formatDateForInput(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function getProjectColor(projectName) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
        const hash = projectName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    function updateTaskDate(recordId, newDate) {
        if (!detectedFields.START_DATE) {
            console.error('Cannot update date - START_DATE field not detected');
            return;
        }
        
        const record = {};
        record[detectedFields.START_DATE] = { value: newDate.toISOString() };
        
        kintone.api('/k/v1/record', 'PUT', {
            app: kintone.app.getId(),
            id: recordId,
            record: record
        }).then(function() {
            showNotification('タスクを移動しました', 'success');
        }).catch(function(error) {
            console.error('Task update error:', error);
            loadAllTasks();
        });
    }

    function saveMemo() {
        const memo = document.getElementById('daily-memo').value;
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`memo-${today}`, memo);
        showNotification('メモを保存しました', 'success');
    }

    function openBackgroundDialog() {
        console.log('Opening background dialog...');
        
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🖼️ 背景画像設定</h3>
                    <button type="button" class="close-btn" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>左側背景画像:</label>
                        <input type="file" id="left-img" accept="image/*">
                        <div id="left-preview" class="img-preview">画像未選択</div>
                        <button type="button" onclick="removeLeftBg()" class="btn btn-sm btn-danger">削除</button>
                    </div>
                    
                    <div class="form-group">
                        <label>右側背景画像:</label>
                        <input type="file" id="right-img" accept="image/*">
                        <div id="right-preview" class="img-preview">画像未選択</div>
                        <button type="button" onclick="removeRightBg()" class="btn btn-sm btn-danger">削除</button>
                    </div>
                    
                    <div class="form-group">
                        <label>透明度: <span id="opacity-display">30%</span></label>
                        <input type="range" id="opacity-slider" min="0" max="100" value="30">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal(this)" class="btn btn-secondary">閉じる</button>
                    <button type="button" onclick="applyBackgrounds()" class="btn btn-primary">適用</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 画像アップロードイベント
        document.getElementById('left-img').onchange = function(e) {
            handleImageUpload(e, 'left');
        };
        
        document.getElementById('right-img').onchange = function(e) {
            handleImageUpload(e, 'right');
        };
        
        document.getElementById('opacity-slider').oninput = function() {
            document.getElementById('opacity-display').textContent = this.value + '%';
        };
        
        loadSavedBackgrounds();
    }
    
    function handleImageUpload(event, side) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            localStorage.setItem(`bg-${side}`, imageData);
            
            const preview = document.getElementById(`${side}-preview`);
            if (preview) {
                preview.style.backgroundImage = `url(${imageData})`;
                preview.style.backgroundSize = 'cover';
                preview.style.height = '60px';
                preview.style.borderRadius = '4px';
                preview.textContent = '画像選択済み';
                preview.style.color = 'white';
                preview.style.textAlign = 'center';
                preview.style.lineHeight = '60px';
                preview.style.textShadow = '1px 1px 1px rgba(0,0,0,0.7)';
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    function loadSavedBackgrounds() {
        ['left', 'right'].forEach(function(side) {
            const saved = localStorage.getItem(`bg-${side}`);
            if (saved) {
                const preview = document.getElementById(`${side}-preview`);
                if (preview) {
                    preview.style.backgroundImage = `url(${saved})`;
                    preview.style.backgroundSize = 'cover';
                    preview.style.height = '60px';
                    preview.style.borderRadius = '4px';
                    preview.textContent = '画像選択済み';
                    preview.style.color = 'white';
                    preview.style.textAlign = 'center';
                    preview.style.lineHeight = '60px';
                    preview.style.textShadow = '1px 1px 1px rgba(0,0,0,0.7)';
                }
            }
        });
        
        const opacity = localStorage.getItem('bg-opacity') || '30';
        const slider = document.getElementById('opacity-slider');
        const display = document.getElementById('opacity-display');
        if (slider && display) {
            slider.value = opacity;
            display.textContent = opacity + '%';
        }
    }

    function applyStoredBackgrounds() {
        const leftBg = localStorage.getItem('bg-left');
        const rightBg = localStorage.getItem('bg-right');
        const opacity = localStorage.getItem('bg-opacity') || '30';
        
        if (leftBg) {
            const leftEl = document.getElementById('left-bg');
            if (leftEl) {
                leftEl.style.backgroundImage = `url(${leftBg})`;
                leftEl.style.opacity = opacity / 100;
            }
        }
        
        if (rightBg) {
            const rightEl = document.getElementById('right-bg');
            if (rightEl) {
                rightEl.style.backgroundImage = `url(${rightBg})`;
                rightEl.style.opacity = opacity / 100;
            }
        }
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(function() {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 4000);
    }

    // 拡張デバッグ用グローバル関数
    window.showComprehensiveDebug = function() {
        const debugDiv = document.getElementById('comprehensive-debug');
        debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
        
        debugDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <strong>検出されたフィールド:</strong><br>
                    ${Object.keys(detectedFields).map(key => 
                        `${key}: <code style="background: #e9ecef; padding: 2px 4px; border-radius: 2px;">${detectedFields[key] || '未検出'}</code>`
                    ).join('<br>')}
                </div>
                <div>
                    <strong>検出状態:</strong><br>
                    フィールド検出完了: ${fieldDetectionComplete ? '✅' : '❌'}<br>
                    必須フィールド: ${detectedFields.TASK_NAME && detectedFields.PROJECT_NAME ? '✅' : '❌'}<br>
                    アプリID: ${kintone.app.getId()}
                </div>
            </div>
            <div style="margin-top: 10px;">
                <strong>推奨アクション:</strong><br>
                1. 「フィールドテスト」ボタンで実際のフィールド存在を確認<br>
                2. 「安全テスト」ボタンで最小限のレコード作成をテスト<br>
                3. エラーが発生した場合はコンソールログを確認
            </div>
        `;
    };

    window.testAllFields = function() {
        console.log('=== 全フィールドテスト実行 ===');
        
        kintone.api('/k/v1/app/form/fields', 'GET', {
            app: kintone.app.getId()
        }).then(function(response) {
            const actualFields = Object.keys(response.properties);
            console.log('実際のフィールド一覧:', actualFields);
            
            // 検出したフィールドの存在確認
            Object.keys(detectedFields).forEach(key => {
                const fieldCode = detectedFields[key];
                if (actualFields.includes(fieldCode)) {
                    console.log(`✅ ${key}(${fieldCode}) - 存在確認`);
                } else {
                    console.error(`❌ ${key}(${fieldCode}) - 存在しません`);
                }
            });
            
            showNotification('フィールドテスト完了 - コンソールを確認', 'info');
        }).catch(function(error) {
            console.error('フィールドテストエラー:', error);
            showNotification('フィールドテストに失敗', 'error');
        });
    };

    window.performSafeTest = function() {
        console.log('=== 安全テスト実行 ===');
        
        if (!detectedFields.TASK_NAME) {
            showNotification('エラー: タスク名フィールドが未検出', 'error');
            return;
        }
        
        // 最小限のレコードでテスト
        const record = {};
        record[detectedFields.TASK_NAME] = { value: '安全テスト - ' + new Date().toLocaleTimeString() };
        
        console.log('テスト用レコード:', record);
        
        kintone.api('/k/v1/record', 'POST', {
            app: kintone.app.getId(),
            record: record
        }).then(function(response) {
            console.log('安全テスト成功:', response);
            showNotification('安全テスト成功 - 最小レコード作成OK', 'success');
            loadAllTasks();
        }).catch(function(error) {
            console.error('安全テスト失敗:', error);
            showNotification('安全テスト失敗: ' + error.message, 'error');
        });
    };

    window.saveTaskSafely = function(recordId = null) {
        console.log('タスクを安全に保存中...');
        
        // 入力値取得
        const taskName = document.getElementById('task-name-input').value;
        const projectName = document.getElementById('project-select').value;
        const description = document.getElementById('task-desc').value;
        const startDate = document.getElementById('start-datetime').value;
        const endDate = document.getElementById('end-datetime').value;
        const taskType = document.getElementById('task-type-select').value;
        const status = document.getElementById('status-select').value;
        
        if (!taskName) {
            alert('タスク名は必須です');
            return;
        }
        
        if (!projectName) {
            alert('案件名は必須です');
            return;
        }
        
        // レコード構築（検出されたフィールドのみ使用）
        const record = {};
        
        if (detectedFields.TASK_NAME) record[detectedFields.TASK_NAME] = { value: taskName };
        if (detectedFields.PROJECT_NAME) record[detectedFields.PROJECT_NAME] = { value: projectName };
        if (detectedFields.START_DATE && startDate) record[detectedFields.START_DATE] = { value: startDate };
        if (detectedFields.END_DATE && endDate) record[detectedFields.END_DATE] = { value: endDate };
        if (detectedFields.TASK_TYPE) record[detectedFields.TASK_TYPE] = { value: taskType };
        if (detectedFields.STATUS) record[detectedFields.STATUS] = { value: status };
        if (detectedFields.DESCRIPTION && description) record[detectedFields.DESCRIPTION] = { value: description };
        
        console.log('保存予定レコード:', record);
        
        const apiCall = recordId ? 
            kintone.api('/k/v1/record', 'PUT', { app: kintone.app.getId(), id: recordId, record: record }) :
            kintone.api('/k/v1/record', 'POST', { app: kintone.app.getId(), record: record });
        
        apiCall.then(function() {
            const modal = document.querySelector('.task-modal');
            if (modal) document.body.removeChild(modal);
            
            loadAllTasks();
            showNotification(recordId ? 'タスクを更新しました' : 'タスクを作成しました', 'success');
        }).catch(function(error) {
            console.error('タスク保存エラー:', error);
            console.error('使用したレコード:', record);
            console.error('使用したフィールドマッピング:', detectedFields);
            showNotification('タスク保存に失敗: ' + error.message, 'error');
        });
    };

    // その他のグローバル関数
    window.closeModal = function(btn) {
        const modal = btn.closest('.task-modal');
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    };

    window.addProject = function() {
        addProjectSafely();
    };

    window.applyBackgrounds = function() {
        const opacity = document.getElementById('opacity-slider').value;
        localStorage.setItem('bg-opacity', opacity);
        
        applyStoredBackgrounds();
        showNotification('背景を適用しました', 'success');
        
        const modal = document.querySelector('.task-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    };

    window.removeLeftBg = function() {
        localStorage.removeItem('bg-left');
        const preview = document.getElementById('left-preview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.textContent = '画像未選択';
        }
        
        const el = document.getElementById('left-bg');
        if (el) el.style.backgroundImage = '';
    };

    window.removeRightBg = function() {
        localStorage.removeItem('bg-right');
        const preview = document.getElementById('right-preview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.textContent = '画像未選択';
        }
        
        const el = document.getElementById('right-bg');
        if (el) el.style.backgroundImage = '';
    };

})();