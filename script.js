// Função para formatar valores em moeda BRL
function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Carrega dados do localStorage ou inicializa arrays vazios
let boletos = JSON.parse(localStorage.getItem('boletos')) || [];
let entradasDiarias = JSON.parse(localStorage.getItem('entradasDiarias')) || [];
let funcionarios = JSON.parse(localStorage.getItem('funcionarios')) || [];

// Variável para armazenar temporariamente o boleto a ser adicionado
let boletoTemp = null;

// Salva os dados no localStorage
function salvarDados() {
  localStorage.setItem('boletos', JSON.stringify(boletos));
  localStorage.setItem('entradasDiarias', JSON.stringify(entradasDiarias));
  localStorage.setItem('funcionarios', JSON.stringify(funcionarios));
}

// Calcula total das entradas
function calcularTotalEntradas() {
  return entradasDiarias.reduce((acc, entrada) => acc + parseFloat(entrada.valor), 0);
}

// Calcula total dos salários
function calcularTotalSalarios() {
  return funcionarios.reduce((acc, func) => acc + parseFloat(func.salario), 0);
}

// Calcula o 5º dia útil do mês; se já passou, retorna o 5º dia útil do próximo mês
function calcularDataPagamentoFuncionarios() {
  const hoje = new Date();
  function get5thBusinessDay(year, month) {
    let date = new Date(year, month, 1);
    let count = 0;
    while (count < 5) {
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        count++;
      }
      if (count < 5) date.setDate(date.getDate() + 1);
    }
    return date;
  }
  let paymentDate = get5thBusinessDay(hoje.getFullYear(), hoje.getMonth());
  if (hoje.getTime() > paymentDate.getTime()) {
    let nextMonth = hoje.getMonth() + 1;
    let year = hoje.getFullYear();
    if (nextMonth > 11) {
      nextMonth = 0;
      year++;
    }
    paymentDate = get5thBusinessDay(year, nextMonth);
  }
  return paymentDate.toLocaleDateString();
}

// Função que determina a urgência de um boleto (pendente) com base na diferença de dias
function getBoletoUrgency(boleto) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(boleto.vencimento);
  due.setHours(0,0,0,0);
  const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
  
  if(diffDays < 0) {
    return { level: "ATRASADO", className: "urgente" };
  } else if(diffDays === 0) {
    return { level: "NÃO PODE ESPERAR", className: "urgente" };
  } else if(diffDays === 1) {
    return { level: "DÁ PRA AFASTAR", className: "alerta" };
  } else if(diffDays <= 7) {
    return { level: "PAGAMENTO URGENTE", className: "urgente" };
  } else if(diffDays <= 14) {
    return { level: "ATENÇÃO", className: "alerta" };
  } else {
    return { level: "Longe", className: "espacado" };
  }
}

// Atualiza o painel de resumo financeiro
function atualizarResumo() {
  const totalEntradas = calcularTotalEntradas();
  const reservado = 10000;
  const saldoDisponivel = totalEntradas - reservado;
  const totalPendentes = boletos
    .filter(boleto => boleto.status === 'pendente')
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
  const totalPagos = boletos
    .filter(boleto => boleto.status === 'pago')
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
  const totalSalarios = calcularTotalSalarios();
  
  document.getElementById('totalEntradas').innerText = `Total de Entradas: ${formatCurrency(totalEntradas)}`;
  document.getElementById('saldoDisponivel').innerText = `Saldo Disponível (após reservar ${formatCurrency(reservado)}): ${formatCurrency(saldoDisponivel)}`;
  document.getElementById('totalBoletosPendentes').innerText = `Total Boletos Pendentes: ${formatCurrency(totalPendentes)}`;
  document.getElementById('totalBoletosPagos').innerText = `Total Boletos Pagos: ${formatCurrency(totalPagos)}`;
  document.getElementById('dividaTotal').innerText = `Dívida Total: ${formatCurrency(totalPendentes)}`;
  
  const saldoFinal = totalEntradas - reservado - totalPendentes;
  const saldoFinalElem = document.getElementById('saldoFinal');
  saldoFinalElem.innerText = `Saldo Final: ${formatCurrency(saldoFinal)}`;
  if (saldoFinal >= 0) {
    saldoFinalElem.classList.add('positivo');
    saldoFinalElem.classList.remove('negativo');
  } else {
    saldoFinalElem.classList.add('negativo');
    saldoFinalElem.classList.remove('positivo');
  }
  
  document.getElementById('totalSalarios').innerText = `Total Salários: ${formatCurrency(totalSalarios)}`;
  document.getElementById('diaPagamentoFuncionarios').innerText = calcularDataPagamentoFuncionarios();
}

// Atualiza o resumo de pagamentos automático usando a data de hoje
function atualizarResumoPagamentos() {
  const today = new Date();
  today.setHours(23,59,59,999); // Considera o dia inteiro
  const totalAteHoje = boletos
    .filter(boleto => boleto.status === 'pendente' && new Date(boleto.vencimento) <= today)
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
  document.getElementById('totalPagamentosAteData').innerText = `Total a Pagar até hoje: ${formatCurrency(totalAteHoje)}`;
  
  const atraso = boletos
    .filter(boleto => boleto.status === 'pendente' && getBoletoUrgency(boleto).level === "ATRASADO")
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
  document.getElementById('pagamentoAtrasado').innerText = `Atrasados: ${formatCurrency(atraso)}`;
  
  const urgent = boletos
    .filter(boleto => boleto.status === 'pendente' && 
      (getBoletoUrgency(boleto).level === "NÃO PODE ESPERAR" || 
       getBoletoUrgency(boleto).level === "DÁ PRA AFASTAR" ||
       getBoletoUrgency(boleto).level === "PAGAMENTO URGENTE"))
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
  document.getElementById('pagamentoUrgente').innerText = `Urgentes: ${formatCurrency(urgent)}`;
  
  const tranquilo = boletos
    .filter(boleto => boleto.status === 'pendente' && getBoletoUrgency(boleto).level === "Longe")
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
  document.getElementById('pagamentoTranquilo').innerText = `Tranquilos: ${formatCurrency(tranquilo)}`;
  
  document.getElementById('gastoSemana').innerText = `Gasto na Semana: ${formatCurrency(calcularGastoSemana())}`;
  document.getElementById('gastoMes').innerText = `Gasto no Mês: ${formatCurrency(calcularGastoMes())}`;
}

// Calcula o gasto nos próximos 7 dias
function calcularGastoSemana() {
  const today = new Date();
  const weekLater = new Date();
  weekLater.setDate(today.getDate() + 7);
  return boletos
    .filter(boleto => boleto.status === 'pendente' && new Date(boleto.vencimento) <= weekLater)
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
}

// Calcula o gasto nos próximos 30 dias
function calcularGastoMes() {
  const today = new Date();
  const monthLater = new Date();
  monthLater.setDate(today.getDate() + 30);
  return boletos
    .filter(boleto => boleto.status === 'pendente' && new Date(boleto.vencimento) <= monthLater)
    .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
}

// Renderiza a lista de entradas diárias com opção de deletar
function renderizarEntradas() {
  const tbody = document.getElementById('entradasTable').querySelector('tbody');
  tbody.innerHTML = '';
  entradasDiarias.forEach((entrada, index) => {
    const row = document.createElement('tr');
    const cellData = document.createElement('td');
    cellData.innerText = entrada.data;
    row.appendChild(cellData);
    const cellValor = document.createElement('td');
    cellValor.innerText = formatCurrency(parseFloat(entrada.valor));
    row.appendChild(cellValor);
    const cellAcoes = document.createElement('td');
    const btnDeletar = document.createElement('button');
    btnDeletar.innerText = 'Deletar';
    btnDeletar.classList.add('action-btn');
    btnDeletar.addEventListener('click', () => {
      if(confirm("Tem certeza que deseja deletar esta entrada?")) {
        entradasDiarias.splice(index, 1);
        salvarDados();
        renderizarEntradas();
        atualizarResumo();
        atualizarResumoPagamentos();
      }
    });
    cellAcoes.appendChild(btnDeletar);
    row.appendChild(cellAcoes);
    tbody.appendChild(row);
  });
}

// Renderiza a lista completa de boletos
function renderizarBoletos() {
  const tbody = document.getElementById('boletoTable').querySelector('tbody');
  tbody.innerHTML = '';
  boletos.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));
  boletos.forEach((boleto, index) => {
    const row = document.createElement('tr');
    
    // Nome e Valor
    const cellNome = document.createElement('td');
    cellNome.innerText = boleto.nome;
    row.appendChild(cellNome);
    
    const cellValor = document.createElement('td');
    cellValor.innerText = formatCurrency(parseFloat(boleto.valor));
    row.appendChild(cellValor);
    
    // Vencimento
    const cellVencimento = document.createElement('td');
    cellVencimento.innerText = new Date(boleto.vencimento).toLocaleDateString();
    row.appendChild(cellVencimento);
    
    // Status (se pendente, mostra urgência; se pago, mostra "Pago")
    const cellStatus = document.createElement('td');
    if(boleto.status === 'pago') {
      cellStatus.innerText = "Pago";
    } else {
      const urgency = getBoletoUrgency(boleto);
      cellStatus.innerText = urgency.level;
      cellStatus.classList.add(urgency.className);
    }
    row.appendChild(cellStatus);
    
    // Ações: marcar como pago e deletar
    const cellAcoes = document.createElement('td');
    if(boleto.status === 'pendente'){
      const btnPagar = document.createElement('button');
      btnPagar.innerText = 'Marcar como Pago';
      btnPagar.classList.add('action-btn');
      btnPagar.addEventListener('click', () => {
        boletos[index].status = 'pago';
        salvarDados();
        renderizarBoletos();
        atualizarResumo();
        atualizarResumoPagamentos();
      });
      cellAcoes.appendChild(btnPagar);
    }
    const btnDeletar = document.createElement('button');
    btnDeletar.innerText = 'Deletar';
    btnDeletar.classList.add('action-btn');
    btnDeletar.addEventListener('click', () => {
      if(confirm("Tem certeza que deseja deletar este boleto?")) {
        boletos.splice(index, 1);
        salvarDados();
        renderizarBoletos();
        atualizarResumo();
        atualizarResumoPagamentos();
      }
    });
    cellAcoes.appendChild(btnDeletar);
    row.appendChild(cellAcoes);
    tbody.appendChild(row);
  });
}

// Renderiza a lista de funcionários com exibição do dia de pagamento
function renderizarFuncionarios() {
  const tbody = document.getElementById('funcionariosTable').querySelector('tbody');
  tbody.innerHTML = '';
  funcionarios.forEach((func, index) => {
    const row = document.createElement('tr');
    const cellNome = document.createElement('td');
    cellNome.innerText = func.nome;
    row.appendChild(cellNome);
    
    const cellSalario = document.createElement('td');
    cellSalario.innerText = formatCurrency(parseFloat(func.salario));
    row.appendChild(cellSalario);
    
    const cellPagamento = document.createElement('td');
    cellPagamento.innerText = calcularDataPagamentoFuncionarios();
    row.appendChild(cellPagamento);
    
    const cellAcoes = document.createElement('td');
    const btnDeletar = document.createElement('button');
    btnDeletar.innerText = 'Deletar';
    btnDeletar.classList.add('action-btn');
    btnDeletar.addEventListener('click', () => {
      if(confirm("Tem certeza que deseja deletar este funcionário?")) {
        funcionarios.splice(index, 1);
        salvarDados();
        renderizarFuncionarios();
        atualizarResumo();
      }
    });
    cellAcoes.appendChild(btnDeletar);
    row.appendChild(cellAcoes);
    tbody.appendChild(row);
  });
}

// Modal para confirmação do cadastro de boleto
const modalAviso = document.getElementById('modalAviso');
const closeModal = document.querySelector('.modal .close');
const btnConfirmar = document.getElementById('confirmarBoleto');
const btnCancelar = document.getElementById('cancelarBoleto');

function abrirModal() {
  modalAviso.style.display = 'block';
}
function fecharModal() {
  modalAviso.style.display = 'none';
  boletoTemp = null;
}
closeModal.addEventListener('click', fecharModal);
btnCancelar.addEventListener('click', fecharModal);
btnConfirmar.addEventListener('click', () => {
  if(boletoTemp) {
    boletos.push(boletoTemp);
    salvarDados();
    renderizarBoletos();
    atualizarResumo();
    atualizarResumoPagamentos();
    fecharModal();
    document.getElementById('boletoForm').reset();
  }
});

// Eventos dos formulários
document.getElementById('entradaForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const valorEntrada = parseFloat(document.getElementById('valorEntrada').value);
  if(!isNaN(valorEntrada) && valorEntrada > 0) {
    entradasDiarias.push({ valor: valorEntrada, data: new Date().toLocaleDateString() });
    salvarDados();
    atualizarResumo();
    renderizarEntradas();
    atualizarResumoPagamentos();
    document.getElementById('entradaForm').reset();
  }
});

document.getElementById('boletoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = document.getElementById('nomeBoleto').value;
  const valor = parseFloat(document.getElementById('valorBoleto').value);
  const vencimento = document.getElementById('vencimentoBoleto').value;
  const status = document.getElementById('statusBoleto').value;
  if(nome && !isNaN(valor) && vencimento) {
    boletoTemp = { nome, valor, vencimento, status };
    abrirModal();
  }
});

document.getElementById('funcionarioForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = document.getElementById('nomeFuncionario').value;
  const salario = parseFloat(document.getElementById('salarioFuncionario').value);
  if(nome && !isNaN(salario)) {
    funcionarios.push({ nome, salario });
    salvarDados();
    renderizarFuncionarios();
    atualizarResumo();
    document.getElementById('funcionarioForm').reset();
  }
});

// Atualiza automaticamente o resumo de pagamentos (usando hoje como referência)
function atualizarPagamentosAutomatico() {
  atualizarResumoPagamentos();
}

// Inicia as interfaces
renderizarEntradas();
renderizarBoletos();
renderizarFuncionarios();
atualizarResumo();
atualizarResumoPagamentos();

// Opcional: Recalcular automaticamente a cada 30 segundos (ou conforme sua necessidade)
// setInterval(atualizarPagamentosAutomatico, 30000);

// Geração do PDF com relatório estruturado e estilizado
document.getElementById('gerarPDF').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const totalEntradas = calcularTotalEntradas();
  const reservado = 10000;
  const saldoDisponivel = totalEntradas - reservado;
  const totalPendentes = boletos.filter(boleto => boleto.status === 'pendente')
                                .reduce((acc, boleto) => acc + parseFloat(boleto.valor), 0);
  const saldoFinal = totalEntradas - reservado - totalPendentes;
  const totalSalarios = calcularTotalSalarios();
  const hoje = new Date().toLocaleDateString();

  doc.setFontSize(16);
  doc.text('Relatório de Gestão Financeira', 14, 15);
  doc.setFontSize(10);
  doc.text(`Data do Relatório: ${hoje}`, 14, 22);

  doc.setFontSize(12);
  doc.text('Resumo Financeiro', 14, 32);
  doc.setFontSize(10);
  doc.text(`Total de Entradas: ${formatCurrency(totalEntradas)}`, 14, 40);
  doc.text(`Reservado para Funcionários: ${formatCurrency(reservado)}`, 14, 46);
  doc.text(`Saldo Disponível: ${formatCurrency(saldoDisponivel)}`, 14, 52);
  doc.text(`Dívida Total (Boletos Pendentes): ${formatCurrency(totalPendentes)}`, 14, 58);
  doc.text(`Saldo Final: ${formatCurrency(saldoFinal)}`, 14, 64);
  doc.text(`Total Salários: ${formatCurrency(totalSalarios)}`, 14, 70);
  doc.text(`Pagamento Funcionários: ${calcularDataPagamentoFuncionarios()}`, 14, 76);

  doc.setFontSize(12);
  doc.text('Entradas Diárias', 14, 86);
  const entradasBody = entradasDiarias.map(entrada => [entrada.data, formatCurrency(parseFloat(entrada.valor))]);
  doc.autoTable({
    startY: 89,
    head: [['Data', 'Valor']],
    body: entradasBody,
    theme: 'striped',
    headStyles: { fillColor: [255, 152, 0] }
  });

  doc.setFontSize(12);
  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 100;
  doc.text('Boletos Recomendados para Pagamento', 14, finalY);
  const recommendation = calcularBoletosRecomendados(new Date().toISOString().split("T")[0]);
  const recomendadosBody = recommendation.recommended.map(boleto => {
    const urg = getBoletoUrgency(boleto);
    return [
      boleto.nome,
      formatCurrency(parseFloat(boleto.valor)),
      new Date(boleto.vencimento).toLocaleDateString(),
      urg.level
    ];
  });
  doc.autoTable({
    startY: finalY + 3,
    head: [['Nome', 'Valor', 'Vencimento', 'Urgência']],
    body: recomendadosBody,
    theme: 'striped',
    headStyles: { fillColor: [255, 152, 0] }
  });

  finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : finalY + 20;
  doc.setFontSize(12);
  doc.text('Lista Completa de Boletos', 14, finalY);
  const boletosBody = boletos.map(boleto => [
    boleto.nome,
    formatCurrency(parseFloat(boleto.valor)),
    new Date(boleto.vencimento).toLocaleDateString(),
    boleto.status === 'pago' ? 'Pago' : getBoletoUrgency(boleto).level
  ]);
  doc.autoTable({
    startY: finalY + 3,
    head: [['Nome', 'Valor', 'Vencimento', 'Status']],
    body: boletosBody,
    theme: 'striped',
    headStyles: { fillColor: [255, 152, 0] }
  });

  finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : finalY + 20;
  doc.setFontSize(12);
  doc.text('Lista de Funcionários', 14, finalY);
  const funcionariosBody = funcionarios.map(func => [
    func.nome,
    formatCurrency(parseFloat(func.salario)),
    calcularDataPagamentoFuncionarios()
  ]);
  doc.autoTable({
    startY: finalY + 3,
    head: [['Nome', 'Salário', 'Pagamento']],
    body: funcionariosBody,
    theme: 'striped',
    headStyles: { fillColor: [255, 152, 0] }
  });

  doc.save('relatorio_financeiro.pdf');
});

renderizarEntradas();
renderizarBoletos();
renderizarFuncionarios();
atualizarResumo();
atualizarResumoPagamentos();
