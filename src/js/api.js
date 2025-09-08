(function() {
    'use strict';

    window.TaskAPI = {
        getTasks: getTasks,
        updateTask: updateTask,
        createTask: createTask,
        deleteTask: deleteTask,
        getProjects: getProjects
    };

    function getTasks(filters = {}) {
        let query = `${FIELD_CODES.START_DATE} != ""`;
        
        if (filters.project) {
            query += ` and ${FIELD_CODES.PROJECT_NAME} = "${filters.project}"`;
        }
        
        if (filters.taskType) {
            query += ` and ${FIELD_CODES.TASK_TYPE} = "${filters.taskType}"`;
        }
        
        if (filters.status) {
            query += ` and ${FIELD_CODES.STATUS} = "${filters.status}"`;
        }
        
        if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            query += ` and ${FIELD_CODES.START_DATE} >= "${start}" and ${FIELD_CODES.START_DATE} <= "${end}"`;
        }

        return kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: query,
            totalCount: true
        });
    }

    function updateTask(recordId, updateData) {
        const record = {};
        
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && updateData[key] !== null) {
                record[key] = { value: updateData[key] };
            }
        });

        return kintone.api('/k/v1/record', 'PUT', {
            app: kintone.app.getId(),
            id: recordId,
            record: record
        });
    }

    function createTask(taskData) {
        const record = {};
        
        Object.keys(taskData).forEach(key => {
            if (taskData[key] !== undefined && taskData[key] !== null) {
                record[key] = { value: taskData[key] };
            }
        });

        return kintone.api('/k/v1/record', 'POST', {
            app: kintone.app.getId(),
            record: record
        });
    }

    function deleteTask(recordId) {
        return kintone.api('/k/v1/record', 'DELETE', {
            app: kintone.app.getId(),
            id: recordId
        });
    }

    function getProjects() {
        return getTasks().then(response => {
            const projects = [...new Set(response.records.map(task => task[FIELD_CODES.PROJECT_NAME].value))];
            return projects.filter(project => project);
        });
    }

    function handleDailyTaskCreation(originalTask, newDate) {
        if (originalTask[FIELD_CODES.TASK_TYPE].value !== TASK_TYPES.DAILY) {
            return Promise.resolve();
        }

        const existingQuery = `${FIELD_CODES.TASK_NAME} = "${originalTask[FIELD_CODES.TASK_NAME].value}" and ${FIELD_CODES.START_DATE} = "${newDate.toISOString().split('T')[0]}"`;
        
        return kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: existingQuery
        }).then(response => {
            if (response.records.length === 0) {
                const taskData = {
                    [FIELD_CODES.TASK_NAME]: originalTask[FIELD_CODES.TASK_NAME].value,
                    [FIELD_CODES.PROJECT_NAME]: originalTask[FIELD_CODES.PROJECT_NAME].value,
                    [FIELD_CODES.START_DATE]: newDate.toISOString(),
                    [FIELD_CODES.TASK_TYPE]: TASK_TYPES.DAILY,
                    [FIELD_CODES.STATUS]: STATUS_TYPES.NOT_STARTED,
                    [FIELD_CODES.ASSIGNEE]: originalTask[FIELD_CODES.ASSIGNEE].value,
                    [FIELD_CODES.DESCRIPTION]: originalTask[FIELD_CODES.DESCRIPTION].value,
                    [FIELD_CODES.PRIORITY]: originalTask[FIELD_CODES.PRIORITY].value,
                    [FIELD_CODES.PROJECT_COLOR]: originalTask[FIELD_CODES.PROJECT_COLOR].value
                };
                
                return createTask(taskData);
            }
        });
    }

    window.TaskAPI.handleDailyTaskCreation = handleDailyTaskCreation;

})();