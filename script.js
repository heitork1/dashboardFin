import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://svbcfhqvgvhmytaespew.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YmNmaHF2Z3ZobXl0YWVzcGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNzQ5MTYsImV4cCI6MjA4Mjc1MDkxNn0.StQ-PIv42XoVUSPEoa7auiSPSLccTl-c6SxzCQBr8uM'
const supabase = createClient(supabaseUrl, supabaseKey)

let dataHeitor = [];
let dataAgatha = [];
let currentView = 'heitor';
let myChart = null;
let subChartsInstances = [];

window.processarArquivos = processarArquivos;
window.switchView = switchView;
window.updateUI = updateUI;

window.toggleMenu = function () {
    const content = document.getElementById('sidebar-content');

    // Se estiver escondido, mostra. Se estiver aparecendo, esconde.
    if (content.classList.contains('sidebar-mobile-hidden')) {
        content.classList.remove('sidebar-mobile-hidden');
        content.classList.add('sidebar-mobile-show');
    } else {
        content.classList.remove('sidebar-mobile-show');
        content.classList.add('sidebar-mobile-hidden');
    }
}

function categorizar(descricao) {
    const desc = descricao.toLowerCase();
    if (desc.includes("uber") || desc.includes("99* pop") || desc.includes("transtusa") || desc.includes("gidion")) return "Transporte";
    if (desc.includes("pizzas") || desc.includes("supermercado") || desc.includes("mercado") || desc.includes("maos peruanas") || desc.includes("campos") || desc.includes("sao marco") || desc.includes("superville")) return "Alimentação";
    if (desc.includes("cdb") || desc.includes("aplicação") || desc.includes("resgate") || desc.includes("investimento") || desc.includes("neon")) return "Investimento";
    if (desc.includes("fatura") || desc.includes("inter")) return "Cartão de Crédito";
    if (desc.includes("claro")) return "Contas Fixas";
    if (desc.includes("agatha") || desc.includes("heitor")) return "Transferência Casal";
    if (desc.includes("prns")) return "Estadia";

    return "Outros";
}

carregarDadosDoBanco();

async function carregarDadosDoBanco() {
    console.log("Buscando dados do Supabase...");

    // Busca todas as transações da tabela
    const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .order('data', { ascending: false });

    if (error) {
        console.error("Erro ao carregar dados:", error);
        return;
    }

    if (data) {
        console.log(`${data.length} transações carregadas do banco.`);

        // Mapeamos de volta para o formato que o seu gráfico/tabela entende
        // Importante: transformamos os nomes das colunas do banco (valor, descricao)
        // para os que o seu código usa (amount, description)
        const formatados = data.map(item => ({
            date: item.data,
            description: item.descricao,
            category: item.categoria,
            amount: item.valor,
            dono: item.dono
        }));

        // Filtramos para as variáveis globais
        dataHeitor = formatados.filter(i => i.dono === "Heitor");
        dataAgatha = formatados.filter(i => i.dono === "Agatha");

        // Atualiza a tela
        updateUI();
    }
}

async function processarArquivos() {
    console.log("Iniciando processamento...");
    const fileHeitor = document.getElementById('csv-heitor').files[0];
    const fileAgatha = document.getElementById('csv-agatha').files[0];

    if (!fileHeitor && !fileAgatha) {
        alert("Por favor, selecione ao menos um arquivo CSV.");
        return;
    }

    if (fileHeitor) {
        const novosDados = await lerCSV(fileHeitor, "Heitor");
        await salvarNoSupabase(novosDados, "Heitor");
    }

    if (fileAgatha) {
        const novosDados = await lerCSV(fileAgatha, "Agatha");
        await salvarNoSupabase(novosDados, "Agatha");
    }

    alert("Dados salvos! Recarregando do banco...");
    await carregarDadosDoBanco();
}
async function salvarNoSupabase(dados, dono) {
    // Mapeamos os dados para o formato das colunas que você criar no banco
    const dadosParaSalvar = dados.map(item => ({
        data: item.date,
        descricao: item.description,
        categoria: item.category,
        valor: item.amount,
        dono: dono // Aqui diferencia se é Heitor ou Agatha
    }));

    const { data, error } = await supabase
        .from('transacoes')
        .insert(dadosParaSalvar);

    if (error) console.error("Erro ao salvar no Supabase:", error);
    else console.log(`Dados de ${dono} salvos com sucesso!`);
}

function lerCSV(file, dono) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const textoOriginal = e.target.result;
            const linhas = textoOriginal.split(/\r?\n/);

            const indiceCabecalho = linhas.findIndex(l => {
                const ln = l.toLowerCase();
                return ln.includes("data") && ln.includes("valor") && ln.includes("saldo");
            });

            if (indiceCabecalho === -1) {
                alert(`Cabeçalho não encontrado para ${dono}`);
                resolve([]);
                return;
            }

            const dadosPuros = linhas.slice(indiceCabecalho + 1);
            const results = dadosPuros.map(linha => {
                if (!linha.trim()) return null;
                const colunas = linha.split(';');
                if (colunas.length < 4) return null;

                const data = colunas[0].trim();
                const desc = colunas[2].trim() || colunas[1].trim();
                const valorStr = colunas[3].trim();

                if (!data.includes("/")) return null;

                return {
                    date: data,
                    description: desc,
                    category: categorizar(desc),
                    amount: limparValor(valorStr)
                };
            }).filter(item => item !== null);

            resolve(results);
        };
        reader.readAsText(file, 'UTF-8');
    });
}

function limparValor(valorString) {
    if (!valorString) return 0;

    // Log para depurar valores estranhos
    // console.log("Limpando valor:", valorString);

    let limpo = valorString
        .replace("R$", "")
        .replace(/\s/g, "") // Remove qualquer espaço em branco
        .replace(/\./g, "") // Remove ponto de milhar
        .replace(",", "."); // Troca vírgula decimal por ponto

    const resultado = parseFloat(limpo);
    if (isNaN(resultado)) {
        console.warn("Falha ao converter valor:", valorString);
        return 0;
    }
    return resultado;
}

function switchView(view) {
    currentView = view;

    // Atualiza botões ativos
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${view}`).classList.add('active');

    const titles = { heitor: 'Finanças do Heitor', agatha: 'Finanças da Agatha', casal: 'Visão do Casal' };
    document.getElementById('view-title').innerText = titles[view];

    updateUI();
}

function parseDataBR(str) {
    if (!str) return new Date(0);
    const [dia, mes, ano] = str.split('/');
    return new Date(ano, mes - 1, dia);
}

function updateUI() {
    let displayData = [];

    // 1. Filtro de Dono (Heitor/Agatha/Casal)
    if (currentView === 'heitor') {
        displayData = [...dataHeitor];
    } else if (currentView === 'agatha') {
        displayData = [...dataAgatha];
    } else {
        displayData = [...dataHeitor, ...dataAgatha];
    }

    // 2. Filtro de Período (Tempo)
    const agora = new Date(); // Hoje é 31/12/2025
    const periodo = document.getElementById('filter-period').value;

    displayData = displayData.filter(item => {
        const dataItem = parseDataBR(item.date);

        if (periodo === 'day') {
            return dataItem.toDateString() === agora.toDateString();
        }

        if (periodo === 'week') {
            // Considera os últimos 7 dias
            const umaSemanaAtras = new Date();
            umaSemanaAtras.setDate(agora.getDate() - 7);
            return dataItem >= umaSemanaAtras && dataItem <= agora;
        }

        if (periodo === 'month') {
            return dataItem.getMonth() === agora.getMonth() &&
                dataItem.getFulflYear() === agora.getFullYear();
        }

        if (periodo === 'year') {
            return dataItem.getFullYear() === agora.getFullYear();
        }

        return true; // "all"
    });

    // 3. Filtro de Busca (Texto)
    const searchTerm = document.getElementById('search').value.toLowerCase();
    if (searchTerm) {
        displayData = displayData.filter(item =>
            item.description.toLowerCase().includes(searchTerm) ||
            item.category.toLowerCase().includes(searchTerm)
        );
    }

    // 4. Ordenação (Sempre do mais recente para o mais antigo)
    displayData.sort((a, b) => parseDataBR(b.date) - parseDataBR(a.date));

    // 5. Renderização
    renderStats(displayData);
    renderTable(displayData);
    renderChart(displayData);
}
function renderStats(data) {
    let income = 0;
    let expense = 0;

    data.forEach(item => {
        if (item.amount > 0) income += item.amount;
        else expense += item.amount;
    });

    document.getElementById('total-income').innerText = income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('total-expense').innerText = Math.abs(expense).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('total-balance').innerText = (income + expense).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        const amountClass = item.amount >= 0 ? 'val-positive' : 'val-negative';

        row.innerHTML = `
            <td>${item.date}</td>
            <td>${item.description}</td>
            <td><span class="tag">${item.category}</span></td>
            <td class="${amountClass}">${item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        `;
        tbody.appendChild(row);
    });
}
function renderChart(data) {
    const canvasMain = document.getElementById('mainChart');
    if (!canvasMain) return;
    const mainCtx = canvasMain.getContext('2d');
    const subContainer = document.getElementById('sub-charts-container');

    subContainer.innerHTML = '';
    subChartsInstances.forEach(chart => chart.destroy());
    subChartsInstances = [];

    const categoryTotals = {};
    const detailData = {};

    // Filtra apenas saídas (valores negativos)
    const expenses = data.filter(i => i.amount < 0);

    expenses.forEach(item => {
        const cat = item.category;
        const val = Math.abs(item.amount);

        categoryTotals[cat] = (categoryTotals[cat] || 0) + val;

        if (!detailData[cat]) detailData[cat] = {};
        let desc = item.description.substring(0, 15).trim();
        detailData[cat][desc] = (detailData[cat][desc] || 0) + val;
    });

    const colors = ['#FF7A00', '#475569', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

    // Gráfico Principal
    if (myChart) myChart.destroy();
    myChart = new Chart(mainCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { size: 11 }, padding: 10 }
                }
            }
        }
    });

    // Gráficos Menores
    Object.keys(detailData).forEach((cat, index) => {
        const card = document.createElement('div');
        card.className = 'mini-chart-card';

        // Formatamos o total da categoria para Moeda Real
        const totalCategoria = categoryTotals[cat].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        card.innerHTML = `
            <div class="mini-chart-header">
                <h4>${cat}</h4>
                <span class="mini-total-valor">${totalCategoria}</span>
            </div>
            <div class="canvas-wrapper">
                <canvas id="chart-${index}"></canvas>
            </div>
        `;
        subContainer.appendChild(card);

        const ctx = document.getElementById(`chart-${index}`).getContext('2d');
        const newSubChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(detailData[cat]),
                datasets: [{
                    data: Object.values(detailData[cat]),
                    backgroundColor: colors.map(c => c + 'CC'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                size: 11 // Diminuir um pouco a fonte no celular ajuda muito
                            }
                        }
                    }
                }
            }
        });
        subChartsInstances.push(newSubChart);
    });
}
// Inicializa a view
switchView('heitor');