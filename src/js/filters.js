(function() {
    'use strict';

    window.FilterManager = {
        init: init,
        updateFilters: updateFilters,
        applyFilters: applyFilters,
        resetFilters: resetFilters
    };

    let activeFilters = {
        projects: [],
        taskTypes: [],
        statuses: [],
        priorities: [],
        assignees: []
    };

    function init() {
        setupAdvancedFilters();
        loadFilterOptions();
    }

    function setupAdvancedFilters() {
        const controlsContainer = document.getElementById('calendar-controls');
        
        const advancedFiltersHTML = `
            <div class="advanced-filters" style="display: none;">
                <div class="filter-row">
                    <div class="filter-group">
                        <label>案件:</label>
                        <div id="project-checkboxes" class="checkbox-group"></div>
                    </div>
                    <div class="filter-group">
                        <label>ステータス:</label>
                        <div id="status-checkboxes" class="checkbox-group">
                            <label><input type="checkbox" value="未着手" checked> 未着手</label>
                            <label><input type="checkbox" value="進行中" checked> 進行中</label>
                            <label><input type="checkbox" value="完了"> 完了</label>
                        </div>
                    </div>
                </div>
                <div class="filter-row">
                    <div class="filter-group">
                        <label>優先度:</label>
                        <div id="priority-checkboxes" class="checkbox-group">
                            <label><input type="checkbox" value="高" checked> 高</label>
                            <label><input type="checkbox" value="中" checked> 中</label>
                            <label><input type="checkbox" value="低" checked> 低</label>
                        </div>
                    </div>
                    <div class="filter-group">
                        <label>担当者:</label>
                        <div id="assignee-checkboxes" class="checkbox-group"></div>
                    </div>
                </div>
                <div class="filter-actions">
                    <button id="reset-filters" class="btn btn-secondary">フィルタリセット</button>
                    <button id="toggle-completed" class="btn btn-outline">完了タスク表示切替</button>
                </div>
            </div>
        `;

        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggle-advanced-filters';
        toggleButton.className = 'btn btn-outline';
        toggleButton.textContent = '詳細フィルタ';
        
        controlsContainer.appendChild(toggleButton);
        controlsContainer.insertAdjacentHTML('afterend', advancedFiltersHTML);

        setupFilterEventListeners();
    }

    function setupFilterEventListeners() {
        document.getElementById('toggle-advanced-filters').addEventListener('click', toggleAdvancedFilters);
        document.getElementById('reset-filters').addEventListener('click', resetFilters);
        document.getElementById('toggle-completed').addEventListener('click', toggleCompletedTasks);

        ['project-checkboxes', 'status-checkboxes', 'priority-checkboxes', 'assignee-checkboxes'].forEach(id => {
            document.getElementById(id).addEventListener('change', handleFilterChange);
        });
    }

    function toggleAdvancedFilters() {
        const filtersContainer = document.querySelector('.advanced-filters');
        const toggleButton = document.getElementById('toggle-advanced-filters');
        
        if (filtersContainer.style.display === 'none') {
            filtersContainer.style.display = 'block';
            toggleButton.textContent = '詳細フィルタを閉じる';
        } else {
            filtersContainer.style.display = 'none';
            toggleButton.textContent = '詳細フィルタ';
        }
    }

    function loadFilterOptions() {
        TaskAPI.getTasks().then(response => {
            const tasks = response.records;
            updateProjectCheckboxes(tasks);
            updateAssigneeCheckboxes(tasks);
        });
    }

    function updateProjectCheckboxes(tasks) {
        const projects = [...new Set(tasks.map(task => task[FIELD_CODES.PROJECT_NAME].value))];
        const container = document.getElementById('project-checkboxes');
        
        container.innerHTML = '';
        projects.forEach(project => {
            if (project) {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${project}" checked> ${project}`;
                container.appendChild(label);
            }
        });
    }

    function updateAssigneeCheckboxes(tasks) {
        const assignees = [...new Set(tasks.map(task => {
            const assignee = task[FIELD_CODES.ASSIGNEE].value;
            return assignee ? assignee.name : null;
        }))];
        
        const container = document.getElementById('assignee-checkboxes');
        
        container.innerHTML = '';
        assignees.forEach(assignee => {
            if (assignee) {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${assignee}" checked> ${assignee}`;
                container.appendChild(label);
            }
        });
    }

    function handleFilterChange() {
        updateActiveFilters();
        applyFilters();
    }

    function updateActiveFilters() {
        activeFilters.projects = getCheckedValues('project-checkboxes');
        activeFilters.statuses = getCheckedValues('status-checkboxes');
        activeFilters.priorities = getCheckedValues('priority-checkboxes');
        activeFilters.assignees = getCheckedValues('assignee-checkboxes');
        
        const taskTypeFilter = document.getElementById('task-type-filter').value;
        activeFilters.taskTypes = taskTypeFilter ? [taskTypeFilter] : [];
    }

    function getCheckedValues(containerId) {
        const container = document.getElementById(containerId);
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function applyFilters() {
        if (!calendar || !currentTasks) return;

        const filteredTasks = currentTasks.filter(task => {
            const projectMatch = activeFilters.projects.length === 0 || 
                activeFilters.projects.includes(task[FIELD_CODES.PROJECT_NAME].value);
            
            const statusMatch = activeFilters.statuses.length === 0 || 
                activeFilters.statuses.includes(task[FIELD_CODES.STATUS].value);
            
            const priorityMatch = activeFilters.priorities.length === 0 || 
                activeFilters.priorities.includes(task[FIELD_CODES.PRIORITY].value);
            
            const assigneeMatch = activeFilters.assignees.length === 0 || 
                activeFilters.assignees.includes(task[FIELD_CODES.ASSIGNEE].value?.name);
            
            const taskTypeMatch = activeFilters.taskTypes.length === 0 || 
                activeFilters.taskTypes.includes(task[FIELD_CODES.TASK_TYPE].value);

            return projectMatch && statusMatch && priorityMatch && assigneeMatch && taskTypeMatch;
        });

        calendar.removeAllEvents();
        const events = filteredTasks.map(task => createCalendarEvent(task));
        calendar.addEventSource(events);
        
        updateFilterCounter(filteredTasks.length, currentTasks.length);
    }

    function updateFilterCounter(filtered, total) {
        let counter = document.getElementById('filter-counter');
        if (!counter) {
            counter = document.createElement('span');
            counter.id = 'filter-counter';
            counter.style.cssText = 'margin-left: 10px; color: #666; font-size: 14px;';
            document.querySelector('#calendar-controls .filter-controls').appendChild(counter);
        }
        
        counter.textContent = `(${filtered}/${total}件表示)`;
    }

    function resetFilters() {
        document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(cb => {
            cb.checked = cb.value !== '完了';
        });
        
        document.getElementById('project-filter').value = '';
        document.getElementById('task-type-filter').value = '';
        
        handleFilterChange();
    }

    function toggleCompletedTasks() {
        const completedCheckbox = document.querySelector('#status-checkboxes input[value="完了"]');
        completedCheckbox.checked = !completedCheckbox.checked;
        handleFilterChange();
    }

    function updateFilters() {
        loadFilterOptions();
    }

})();