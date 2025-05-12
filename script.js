// Определяем операторы и их приоритеты
const precedence = {
    '¬': 5, // Унарный минус/отрицание
    '&': 4, // Конъюнкция
    '^': 3, // XOR
    '||': 2, // Дизъюнкция
    '→': 1, // Импликация
    '↔': 0  // Эквиваленция
};

// Функции для выполнения логических операций (работаем с 0 и 1)
const operations = {
    '¬': (a) => a === 0 ? 1 : 0,
    '&': (a, b) => a === 1 && b === 1 ? 1 : 0,
    '||': (a, b) => a === 1 || b === 1 ? 1 : 0,
    '→': (a, b) => a === 0 || b === 1 ? 1 : 0, // a → b === ¬a || b
    '↔': (a, b) => a === b ? 1 : 0,           // a ↔ b === (a → b) & (b → a)
    '^': (a, b) => a !== b ? 1 : 0            // XOR
};

// --- Логика парсинга и вычисления ---
function tokenize(expression) {
    expression = expression.replace(/\s+/g, '');
    if (!expression) return [];

    // Паттерн для поиска: ||, →, ↔, ¬, &, ^, скобок, переменных (одиночные латинские буквы)
    const regex = /(\|\||→|↔|¬|&|\^|\(|\)|[a-z])/g;
    const tokens = expression.match(regex);

    if (!tokens || tokens.join('') !== expression) {
        console.error("Ошибка токенизации: Нераспознанные символы в выражении.", expression, tokens);
        return null;
    }
    return tokens;
}

function evaluateWithSteps(tokens, varValues) {
    const valuesStack = []; // Стек для { value: 0|1, expr: string }
    const opsStack = [];    // Стек для операторов
    const steps = {};       // Для хранения промежуточных результатов { 'выражение': результат }

    // Добавляем начальные значения переменных в steps
    for (const varName in varValues) {
        steps[varName] = varValues[varName];
    }

    const applyOp = () => {
        if (opsStack.length === 0) throw new Error("Стек операторов пуст при попытке применения операции");

        const op = opsStack.pop();
        let resultValue;
        let resultExpr;

        if (op === '¬') {
            if (valuesStack.length < 1) throw new Error(`Недостаточно операндов для оператора ${op}`);
            const operand = valuesStack.pop();
            // Убираем лишние внешние скобки для читаемости, если операнд - переменная
            const operandExpr = /^[a-z]$/.test(operand.expr) || operand.expr.startsWith('¬') ? operand.expr : `(${operand.expr})`;
            resultValue = operations[op](operand.value);
            resultExpr = `${op}${operandExpr}`; // Формат ¬a или ¬(...)

        } else { // Бинарные операторы
            if (valuesStack.length < 2) throw new Error(`Недостаточно операндов для оператора ${op}`);
            const right = valuesStack.pop();
            const left = valuesStack.pop();

            if (!(op in operations)) throw new Error(`Неизвестный бинарный оператор: ${op}`);

            resultValue = operations[op](left.value, right.value);
            // Добавляем скобки вокруг операндов, если они сами являются выражениями (не просто переменными)
            const leftExprFmt = /^[a-z]$/.test(left.expr) ? left.expr : `(${left.expr})`;
            const rightExprFmt = /^[a-z]$/.test(right.expr) ? right.expr : `(${right.expr})`;
            resultExpr = `${leftExprFmt} ${op} ${rightExprFmt}`;
        }

        // Сохраняем результат шага, только если это не просто переменная
         if (!/^[a-z]$/.test(resultExpr)) {
              steps[resultExpr] = resultValue;
         }
        valuesStack.push({ value: resultValue, expr: resultExpr });
    };

    for (const token of tokens) {
        if (token >= 'a' && token <= 'z') {
            if (!(token in varValues)) throw new Error(`Неизвестная переменная: ${token}`);
            valuesStack.push({ value: varValues[token], expr: token });
        } else if (token === '(') {
            opsStack.push(token);
        } else if (token === ')') {
            while (opsStack.length > 0 && opsStack[opsStack.length - 1] !== '(') {
                applyOp();
            }
            if (opsStack.length === 0 || opsStack[opsStack.length - 1] !== '(') {
                throw new Error("Несогласованные скобки (нет открывающей '()'");
            }
            opsStack.pop(); // Удаляем '('
        } else if (token in precedence) {
            while (
                opsStack.length > 0 &&
                opsStack[opsStack.length - 1] !== '(' &&
                precedence[opsStack[opsStack.length - 1]] >= precedence[token]
            ) {
                applyOp();
            }
            opsStack.push(token);
        } else {
            throw new Error(`Нераспознанный токен: ${token}`);
        }
    }

    // Применяем оставшиеся операторы
    while (opsStack.length > 0) {
        if (opsStack[opsStack.length - 1] === '(') {
            throw new Error("Несогласованные скобки (осталась открывающая '(')");
        }
        applyOp();
    }

    // В конце в стеке значений должен остаться один элемент
    if (valuesStack.length !== 1) {
        console.error("Ошибка вычисления: Неверное количество значений в стеке", valuesStack);
        throw new Error("Ошибка в структуре выражения или логике вычисления");
    }

    // Добавляем финальное выражение (может совпадать с одним из шагов)
     const finalExpr = valuesStack[0].expr;
     const finalResult = valuesStack[0].value;
     // Убираем внешние скобки если они есть у всего выражения
     const formattedFinalExpr = /^\(.*\)$/.test(finalExpr) && tokens.length > 1 // не убирать скобки если выражение типа (a)
                              ? finalExpr.substring(1, finalExpr.length - 1)
                              : finalExpr;

     steps[formattedFinalExpr] = finalResult; // Используем оригинальное выражение или его упрощенную форму

    return { finalResult: finalResult, steps: steps };
}


// Генерирует данные для таблицы истинности, включая промежуточные шаги.
// @param {string} originalExpression - Исходное логическое выражение.
// @returns {{
//  ariables: Array<string>,
//  table: Array<Record<string, 0|1>>,
//  columns: Array<string>,
//  error?: string
// }}

function generateTruthTableData(originalExpression) {
    const expression = originalExpression.replace(/\s+/g, ''); // Работаем с выражением без пробелов
    const variables = [...new Set(expression.replace(/[^a-z]/g, ''))].sort();
    const numVars = variables.length;
    const numRows = Math.pow(2, numVars);
    const table = [];
    let allColumns = new Set(variables); // Начинаем с переменных
    let errorMsg = null;

    const tokens = tokenize(expression);
    if (tokens === null) {
        return { variables: [], table: [], columns: [], error: "Ошибка: Нераспознанные символы в выражении." };
    }
    if (tokens.length === 0 && variables.length === 0) {
        return { variables: [], table: [], columns: [], error: "Ошибка: Пустое выражение." };
    }
     if (tokens.length > 0 && variables.length === 0) {
        // Обработка константных выражений (например, "¬(1&0)") - пока не поддерживается
         return { variables: [], table: [], columns: [], error: "Ошибка: Выражения без переменных (только с константами) пока не поддерживаются." };
    }

    for (let i = 0; i < numRows; i++) {
        const rowData = {};
        const currentVarValues = {};

        // 1. Устанавливаем значения переменных
        for (let j = 0; j < numVars; j++) {
            const varName = variables[j];
            const value = (i >> (numVars - 1 - j)) & 1;
            currentVarValues[varName] = value;
            rowData[varName] = value; // Добавляем в данные строки
        }

        // 2. Вычисляем выражение со всеми шагами
        try {
            const result = evaluateWithSteps(tokens, currentVarValues);
            // Добавляем все вычисленные шаги (подвыражения) в данные строки
            for (const stepExpr in result.steps) {
                // Не перезаписываем исходные переменные, если они попали в steps
                if (!variables.includes(stepExpr)) {
                     rowData[stepExpr] = result.steps[stepExpr];
                     allColumns.add(stepExpr); // Собираем все уникальные подвыражения для заголовков
                } else {
                    // Убедимся что значение переменной в rowData верное (хотя оно уже должно быть)
                    rowData[stepExpr] = currentVarValues[stepExpr];
                }
            }

        } catch (e) {
            console.error(`Ошибка вычисления для строки ${i}:`, e.message, "Значения:", currentVarValues);
            errorMsg = `Ошибка вычисления: ${e.message}`;
            break;
        }

        table.push(rowData);
    }

    if (errorMsg) {
        return { variables, table: [], columns: [], error: errorMsg };
    }

    // 3. Определяем и сортируем столбцы
    // Порядок: переменные -> подвыражения по сложности (длине) -> финальное выражение
    const sortedColumns = [...allColumns];
    sortedColumns.sort((a, b) => {
        // Переменные всегда в начале
        const aIsVar = variables.includes(a);
        const bIsVar = variables.includes(b);
        if (aIsVar && !bIsVar) return -1;
        if (!aIsVar && bIsVar) return 1;
        if (aIsVar && bIsVar) return a.localeCompare(b); // Сортируем переменные по алфавиту

        // Сортируем подвыражения по длине
        return a.length - b.length || a.localeCompare(b); // При равной длине - по алфавиту
    });

     // Убедимся, что оригинальное выражение (или его эквивалент из steps) есть и оно последнее,
     // если оно не является просто переменной.
     let finalExprKey = null;
     if (table.length > 0) {
         // Пытаемся найти ключ финального выражения в последней строке
         const lastRowKeys = Object.keys(table[table.length - 1]);
         // Ищем ключ, соответствующий результату вычисления всего выражения
         // Обычно это самый длинный ключ или ключ, совпадающий с исходным выражением
         let potentialFinalKey = expression; // Исходное выражение без пробелов
         if (lastRowKeys.includes(potentialFinalKey)) {
              finalExprKey = potentialFinalKey;
         } else {
              // Если точного совпадения нет, ищем самый длинный ключ (кроме переменных)
              let maxLength = -1;
               lastRowKeys.forEach(key => {
                   if (!variables.includes(key) && key.length > maxLength) {
                       maxLength = key.length;
                       finalExprKey = key;
                   } else if (!variables.includes(key) && key.length === maxLength) {
                        finalExprKey = key;
                   }
               });
         }


         if (finalExprKey && finalExprKey !== variables[0]) { // Не перемещаем, если выражение - одна переменная
             const index = sortedColumns.indexOf(finalExprKey);
             if (index > -1) {
                 sortedColumns.splice(index, 1); // Удаляем из текущей позиции
                 sortedColumns.push(finalExprKey);  // Добавляем в конец
             } else {
                 // Если ключ не нашелся (маловероятно), добавляем оригинальное выражение
                 if (!sortedColumns.includes(expression)) {
                    sortedColumns.push(expression);
                 }
             }
         }
     }


    // Очищаем от дубликатов на всякий случай
    const uniqueSortedColumns = [...new Set(sortedColumns)];


    return { variables, table, columns: uniqueSortedColumns };
}


//Отображает таблицу истинности или ошибку на странице.
 
function generateTable() {
    const expressionInput = document.getElementById('expression');
    const expression = expressionInput.value;
    const tableContainer = document.getElementById('tableContainer');
    const errorContainer = document.getElementById('errorContainer');

    // Очистка предыдущих результатов
    tableContainer.innerHTML = '';
    errorContainer.innerHTML = '';
    errorContainer.className = '';

    // Генерация данных
    const { variables, table, columns, error } = generateTruthTableData(expression);

    // Отображение ошибки
    if (error) {
        errorContainer.className = 'alert alert-danger';
        errorContainer.textContent = error;
        return;
    }

    // Проверки на пустые результаты
    if (table.length === 0 && variables.length === 0 && expression.length > 0) { /* ... */ return; }
    if (table.length === 0 && variables.length === 0 && expression.length === 0) { /* ... */ return; }
    if (table.length === 0 && columns.length > 0) { /* ... */ return; }

    let tableHtml = '<table id="truthTable" class="table">';
    tableHtml += '<thead><tr>';

    columns.forEach((col) => {
        const th = document.createElement('th');
        if (col.length > 1 && !col.startsWith('¬') || col.includes(' ')) {
             th.innerHTML = `<code>${col.replace(/</g, "<").replace(/>/g, ">")}</code>`;
        } else {
            th.textContent = col;
        }
        tableHtml += th.outerHTML;
    });
    tableHtml += '</tr></thead><tbody>';

    // Строки таблицы (tbody)
    table.forEach(row => {
        tableHtml += '<tr>';
        columns.forEach(col => {
            const value = row[col] !== undefined ? row[col] : '?';
            tableHtml += `<td>${value}</td>`;
        });
        tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';

    tableContainer.innerHTML = `<div class="table-responsive">${tableHtml}</div>`;
}

