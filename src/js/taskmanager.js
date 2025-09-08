(function() {
    'use strict';

    window.TaskManager = {
        init: init,
        handleDailyTaskGeneration: handleDailyTaskGeneration,
        createRecurringTasks: createRecurringTasks,
        checkDailyTaskConflicts: checkDailyTaskConflicts
    };

    function init() {
        setupTaskTypeSpecificBehavior();
        setupDailyTaskGenerator();
    }

    function setupTaskTypeSpecificBehavior() {
        const style = document.createElement('style');
        style.textContent = `
            .fc-event.task-type-デイリー {
                border-style: dashed;
                position: relative;
            }
            
            .fc-event.task-type-デイリー::after {
                content: "♻️";
                position: absolute;
                top: -2px;
                right: 2px;
                font-size: 10px;
            }
            
            .fc-event.task-type-単発 {
                border-style: solid;
            }
            
            .fc-event.task-type-単発::after {
                content: "📝";
                position: absolute;
                top: -2px;
                right: 2px;
                font-size: 10px;
            }
            
            .daily-task-indicator {
                background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%);
                background-size: 10px 10px;
            }
            
            .task-conflict {
                border: 2px solid #ff6b6b !important;
                animation: pulse-red 1s infinite;
            }
            
            @keyframes pulse-red {
                0% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7); }
                70% { box-shadow: 0 0 0 4px rgba(255, 107, 107, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0); }
            }
        `;
        document.head.appendChild(style);
    }

    function setupDailyTaskGenerator() {
        const controlsContainer = document.getElementById('calendar-controls');
        
        const generatorHTML = `
            <div class="daily-task-generator">
                <button id="generate-daily-tasks" class="btn btn-success">
                    デイリータスク一括生成
                </button>
                <div id="generation-options" style="display: none;">
                    <div class="generation-form">
                        <div class="form-group">
                            <label>生成期間:</label>
                            <input type="date" id="generation-start-date" value="${new Date().toISOString().split('T')[0]}">
                            <span>〜</span>
                            <input type="date" id="generation-end-date" value="${getNextWeekDate()}">
                        </div>
                        <div class="form-group">
                            <label>対象デイリータスク:</label>
                            <div id="daily-task-templates"></div>
                        </div>
                        <div class="form-actions">
                            <button id="execute-generation" class="btn btn-primary">生成実行</button>
                            <button id="cancel-generation" class="btn btn-secondary">キャンセル</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        controlsContainer.insertAdjacentHTML('beforeend', generatorHTML);
        setupGeneratorEventListeners();
    }

    function setupGeneratorEventListeners() {
        document.getElementById('generate-daily-tasks').addEventListener('click', showGenerationOptions);
        document.getElementById('execute-generation').addEventListener('click', executeDailyTaskGeneration);
        document.getElementById('cancel-generation').addEventListener('click', hideGenerationOptions);
    }

    function showGenerationOptions() {
        loadDailyTaskTemplates();
        document.getElementById('generation-options').style.display = 'block';
        document.getElementById('generate-daily-tasks').style.display = 'none';
    }

    function hideGenerationOptions() {
        document.getElementById('generation-options').style.display = 'none';
        document.getElementById('generate-daily-tasks').style.display = 'block';
    }

    function loadDailyTaskTemplates() {
        const query = `${FIELD_CODES.TASK_TYPE} = "${TASK_TYPES.DAILY}"`;
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: query
        }).then(response => {
            const templates = [...new Map(response.records.map(task => [
                task[FIELD_CODES.TASK_NAME].value,
                task
            ])).values()];
            
            displayTaskTemplates(templates);
        });
    }

    function displayTaskTemplates(templates) {
        const container = document.getElementById('daily-task-templates');
        container.innerHTML = '';
        
        templates.forEach(template => {
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${template.$id.value}" checked>
                ${template[FIELD_CODES.TASK_NAME].value} 
                (${template[FIELD_CODES.PROJECT_NAME].value})
            `;
            container.appendChild(label);
        });
    }

    function executeDailyTaskGeneration() {
        const startDate = new Date(document.getElementById('generation-start-date').value);
        const endDate = new Date(document.getElementById('generation-end-date').value);
        const selectedTemplates = getCheckedValues('daily-task-templates');
        
        if (selectedTemplates.length === 0) {
            alert('生成するデイリータスクを選択してください');
            return;
        }

        generateDailyTasksForPeriod(startDate, endDate, selectedTemplates)
            .then(() => {
                hideGenerationOptions();
                loadTasks();
                showNotification('デイリータスクを生成しました', 'success');
            })
            .catch(error => {
                console.error('デイリータスク生成エラー:', error);
                showNotification('デイリータスクの生成に失敗しました', 'error');
            });
    }

    function generateDailyTasksForPeriod(startDate, endDate, templateIds) {
        const promises = [];
        
        templateIds.forEach(templateId => {
            const template = currentTasks.find(task => task.$id.value === templateId);
            if (!template) return;
            
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                promises.push(createDailyTaskForDate(template, new Date(currentDate)));
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });
        
        return Promise.all(promises);
    }

    function createDailyTaskForDate(template, targetDate) {
        const dateStr = targetDate.toISOString().split('T')[0];
        const existingQuery = `${FIELD_CODES.TASK_NAME} = "${template[FIELD_CODES.TASK_NAME].value}" and ${FIELD_CODES.START_DATE} like "${dateStr}"`;
        
        return kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: existingQuery
        }).then(response => {
            if (response.records.length === 0) {
                const taskData = {
                    [FIELD_CODES.TASK_NAME]: template[FIELD_CODES.TASK_NAME].value,
                    [FIELD_CODES.PROJECT_NAME]: template[FIELD_CODES.PROJECT_NAME].value,
                    [FIELD_CODES.START_DATE]: targetDate.toISOString(),
                    [FIELD_CODES.TASK_TYPE]: TASK_TYPES.DAILY,
                    [FIELD_CODES.STATUS]: STATUS_TYPES.NOT_STARTED,
                    [FIELD_CODES.ASSIGNEE]: template[FIELD_CODES.ASSIGNEE].value,
                    [FIELD_CODES.DESCRIPTION]: template[FIELD_CODES.DESCRIPTION].value,
                    [FIELD_CODES.PRIORITY]: template[FIELD_CODES.PRIORITY].value,
                    [FIELD_CODES.PROJECT_COLOR]: template[FIELD_CODES.PROJECT_COLOR].value
                };
                
                return TaskAPI.createTask(taskData);
            }
        });
    }

    function handleDailyTaskGeneration(originalTask, targetDate) {
        if (originalTask[FIELD_CODES.TASK_TYPE].value !== TASK_TYPES.DAILY) {
            return Promise.resolve();
        }

        return createDailyTaskForDate(originalTask, targetDate);
    }

    function checkDailyTaskConflicts(tasks) {
        const conflicts = [];
        const dailyTasks = tasks.filter(task => task[FIELD_CODES.TASK_TYPE].value === TASK_TYPES.DAILY);
        
        const tasksByDateAndName = {};
        dailyTasks.forEach(task => {
            const date = task[FIELD_CODES.START_DATE].value.split('T')[0];
            const name = task[FIELD_CODES.TASK_NAME].value;
            const key = `${date}_${name}`;
            
            if (!tasksByDateAndName[key]) {
                tasksByDateAndName[key] = [];
            }
            tasksByDateAndName[key].push(task);
        });
        
        Object.values(tasksByDateAndName).forEach(taskGroup => {
            if (taskGroup.length > 1) {
                conflicts.push(...taskGroup);
            }
        });
        
        return conflicts;
    }

    function getNextWeekDate() {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString().split('T')[0];
    }

    function getCheckedValues(containerId) {
        const container = document.getElementById(containerId);
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

})();