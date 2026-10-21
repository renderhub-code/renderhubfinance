-- Novo plano de contas (estrutura do hub-finance-master) para as empresas que não usam o Bling.
-- A Use Noronha mantém o plano atual, alimentado pelas categorias do Bling.
-- Só converte empresas que ainda não estão no novo plano (sem a conta 12.03).
DROP TABLE IF EXISTS pg_temp.tgt;
CREATE TEMP TABLE tgt AS
SELECT c.id FROM public.companies c
WHERE c.slug <> 'use-noronha'
  AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.company_id = c.id AND a.code = '12.03');

UPDATE public.account_groups SET code = 'X' || code WHERE code NOT LIKE 'X%' AND company_id IN (SELECT id FROM tgt);
UPDATE public.account_subgroups SET code = 'X' || code WHERE code NOT LIKE 'X%' AND company_id IN (SELECT id FROM tgt);
INSERT INTO public.account_groups (company_id, code, name, type, dre_section, sort_order, active)
SELECT c.id, g.code, g.name, g.type::public.account_type, g.dre::public.dre_section, g.ord*10, true
FROM public.companies c
CROSS JOIN (VALUES (1,'1','Receitas Operacionais','entrada','receita_bruta'),(2,'2','Deduções da Receita','saida','deducoes'),(3,'3','Custos','saida','custos'),(4,'4','Despesas Administrativas','saida','despesas_administrativas'),(5,'5','Despesas de Pessoal','saida','despesas_operacionais'),(6,'6','Manutenção e Conservação','saida','despesas_operacionais'),(7,'7','Despesas de Estrutura','saida','despesas_operacionais'),(8,'8','Despesas Comerciais','saida','despesas_comerciais'),(9,'9','Receitas Financeiras','entrada','receitas_financeiras'),(10,'10','Despesas Financeiras','saida','despesas_financeiras'),(11,'11','Imobilizado e Ativos','saida','investimentos'),(12,'12','Empréstimos e Financiamentos','entrada','nao_operacional'),(13,'13','Transferências','saida','nao_operacional'),(14,'14','Movimentações Não Operacionais','entrada','nao_operacional')) AS g(ord, code, name, type, dre)
WHERE c.active AND c.id IN (SELECT id FROM tgt) AND NOT EXISTS (SELECT 1 FROM public.account_groups ag WHERE ag.company_id=c.id AND ag.code=g.code);
INSERT INTO public.account_subgroups (company_id, group_id, code, name, sort_order, active)
SELECT ag.company_id, ag.id, ag.code, ag.name, ag.sort_order, true
FROM public.account_groups ag
WHERE ag.code NOT LIKE 'X%' AND ag.company_id IN (SELECT id FROM tgt)
  AND NOT EXISTS (SELECT 1 FROM public.account_subgroups sg WHERE sg.company_id=ag.company_id AND sg.code=ag.code);
INSERT INTO public.accounts (company_id, subgroup_id, code, name, type, sort_order, active)
SELECT sg.company_id, sg.id, a.code, a.name, a.type::public.account_type, a.ord, true
FROM (VALUES ('1.01','1','Venda de produtos','entrada',10),('1.02','1','Venda de mercadorias','entrada',20),('1.03','1','Prestação de serviços','entrada',30),('1.04','1','Outras receitas operacionais','entrada',40),('1.05','1','Receita de Importação por Encomenda','entrada',50),('1.06','1','Receita de Importação por Conta e Ordem','entrada',60),('1.07','1','Outras Receitas de Importação','entrada',70),('2.01','2','ICMS','saida',80),('2.02','2','ISS','saida',90),('2.03','2','PIS/COFINS','saida',100),('2.04','2','Simples Nacional','saida',110),('2.05','2','Outros impostos sobre faturamento','saida',120),('2.06','2','Devoluções de vendas','saida',130),('2.07','2','Cancelamentos','saida',140),('2.08','2','Descontos concedidos','saida',150),('3.01','3','Compras para revenda','saida',160),('3.02','3','Matéria-prima','saida',170),('3.03','3','Insumos','saida',180),('3.04','3','Embalagens','saida',190),('3.05','3','Fretes sobre compras','saida',200),('3.06','3','Custo com Qualidade','saida',210),('3.07','3','Custos diretamente relacionados à prestação de serviços','saida',220),('3.08','3','Outros custos operacionais','saida',230),('4.01','4','Contabilidade','saida',240),('4.02','4','Assessoria jurídica','saida',250),('4.03','4','Consultorias','saida',260),('4.04','4','Sistemas e softwares','saida',270),('4.05','4','Material de escritório','saida',280),('4.06','4','Serviços administrativos','saida',290),('4.07','4','Taxas e licenças','saida',300),('4.08','4','Outras despesas administrativas','saida',310),('5.01','5','Salários','saida',320),('5.02','5','Pró-labore','saida',330),('5.03','5','INSS','saida',340),('5.04','5','FGTS','saida',350),('5.05','5','Férias','saida',360),('5.06','5','13º Salário','saida',370),('5.07','5','Benefícios','saida',380),('5.08','5','Vale-transporte','saida',390),('5.09','5','Vale-refeição/alimentação','saida',400),('5.10','5','Rescisões','saida',410),('5.11','5','Outras despesas com pessoal','saida',420),('6.01','6','Manutenção de máquinas e equipamentos','saida',430),('6.02','6','Manutenção predial','saida',440),('6.03','6','Manutenção de veículos','saida',450),('6.04','6','Reparos','saida',460),('6.05','6','Peças e componentes','saida',470),('6.06','6','Outros serviços de manutenção','saida',480),('7.01','7','Aluguel','saida',490),('7.02','7','Energia elétrica','saida',500),('7.03','7','Água','saida',510),('7.04','7','Telefone','saida',520),('7.05','7','Internet','saida',530),('7.06','7','Condomínio','saida',540),('7.07','7','Seguros','saida',550),('7.08','7','Segurança','saida',560),('7.09','7','Limpeza','saida',570),('7.10','7','Outras despesas de estrutura','saida',580),('8.01','8','Publicidade e propaganda','saida',590),('8.02','8','Marketing digital','saida',600),('8.03','8','Comissões de vendas','saida',610),('8.04','8','Representantes comerciais','saida',620),('8.05','8','Eventos e feiras','saida',630),('8.06','8','Viagens comerciais','saida',640),('8.07','8','Brindes e materiais promocionais','saida',650),('8.08','8','Fretes e entregas a clientes','saida',660),('8.09','8','Outras despesas comerciais','saida',670),('9.01','9','Rendimentos de aplicações','entrada',680),('9.02','9','Juros recebidos','entrada',690),('9.03','9','Descontos obtidos','entrada',700),('9.04','9','Outras receitas financeiras','entrada',710),('9.11','10','Juros de empréstimos','saida',720),('9.12','10','Juros de financiamentos','saida',730),('9.13','10','Tarifas bancárias','saida',740),('9.14','10','IOF','saida',750),('9.15','10','Multas e juros financeiros','saida',760),('9.16','10','Descontos concedidos por antecipação','saida',770),('9.17','10','Outras despesas financeiras','saida',780),('10.01','11','Compra de máquinas','saida',790),('10.02','11','Compra de equipamentos','saida',800),('10.03','11','Compra de computadores e eletrônicos','saida',810),('10.04','11','Compra de móveis e utensílios','saida',820),('10.05','11','Compra de veículos','saida',830),('10.06','11','Obras e instalações','saida',840),('10.07','11','Compra de imóveis','saida',850),('10.08','11','Outros investimentos em ativos','saida',860),('10.11','11','Venda de máquinas/equipamentos','entrada',870),('10.12','11','Venda de veículos','entrada',880),('10.13','11','Venda de imóveis','entrada',890),('10.14','11','Venda de outros ativos','entrada',900),('11.01','12','Empréstimos bancários','entrada',910),('11.02','12','Financiamentos','entrada',920),('11.03','12','Empréstimos de sócios','entrada',930),('11.04','12','Outras captações','entrada',940),('11.11','12','Amortização de empréstimos','saida',950),('11.12','12','Amortização de financiamentos','saida',960),('11.13','12','Pagamento de empréstimos de sócios','saida',970),('11.14','12','Quitação antecipada de empréstimos','saida',980),('11.15','12','Outras amortizações','saida',990),('12.01','13','Transferência entre contas bancárias','saida',1000),('12.02','13','Transferência entre empresas','saida',1010),('12.03','13','Aporte de sócios','entrada',1020),('12.04','13','Retirada/distribuição para sócios','saida',1030),('12.05','13','Outras transferências','saida',1040),('13.01','14','Aporte de capital','entrada',1050),('13.02','14','Distribuição de lucros','saida',1060),('13.03','14','Adiantamento a sócios','saida',1070),('13.04','14','Adiantamento de sócios','entrada',1080),('13.05','14','Empréstimos concedidos a terceiros','saida',1090),('13.06','14','Recebimento de empréstimos concedidos','entrada',1100),('13.07','14','Outras movimentações não operacionais','entrada',1110)) AS a(code, sgcode, name, type, ord)
JOIN public.account_subgroups sg ON sg.code = a.sgcode AND sg.company_id IN (SELECT id FROM tgt)
WHERE NOT EXISTS (SELECT 1 FROM public.accounts ac WHERE ac.company_id=sg.company_id AND ac.code=a.code);
UPDATE public.transactions t SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '12.03'
WHERE t.account_id = old.id AND old.code = '0.1.001' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.simulation_lines sl SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '12.03'
WHERE sl.account_id = old.id AND old.code = '0.1.001' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.account_mappings m SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '12.03'
WHERE m.account_id = old.id AND m.company_id = old.company_id AND old.code = '0.1.001' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.transactions t SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '13.02'
WHERE t.account_id = old.id AND old.code = '0.1.002' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.simulation_lines sl SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '13.02'
WHERE sl.account_id = old.id AND old.code = '0.1.002' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.account_mappings m SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '13.02'
WHERE m.account_id = old.id AND m.company_id = old.company_id AND old.code = '0.1.002' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.transactions t SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.07'
WHERE t.account_id = old.id AND old.code = '1.1.001' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.simulation_lines sl SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.07'
WHERE sl.account_id = old.id AND old.code = '1.1.001' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.account_mappings m SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.07'
WHERE m.account_id = old.id AND m.company_id = old.company_id AND old.code = '1.1.001' AND old.company_id IN (SELECT id FROM tgt);
UPDATE public.transactions t SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.01'
WHERE t.account_id = old.id AND old.code = '1.2.001' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id NOT IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.simulation_lines sl SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.01'
WHERE sl.account_id = old.id AND old.code = '1.2.001' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id NOT IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.account_mappings m SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.01'
WHERE m.account_id = old.id AND m.company_id = old.company_id AND old.code = '1.2.001' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id NOT IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.transactions t SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.06'
WHERE t.account_id = old.id AND old.code = '1.2.001' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.simulation_lines sl SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.06'
WHERE sl.account_id = old.id AND old.code = '1.2.001' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.account_mappings m SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.06'
WHERE m.account_id = old.id AND m.company_id = old.company_id AND old.code = '1.2.001' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.transactions t SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.02'
WHERE t.account_id = old.id AND old.code = '1.2.002' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id NOT IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.simulation_lines sl SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.02'
WHERE sl.account_id = old.id AND old.code = '1.2.002' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id NOT IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.account_mappings m SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.02'
WHERE m.account_id = old.id AND m.company_id = old.company_id AND old.code = '1.2.002' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id NOT IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.transactions t SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.05'
WHERE t.account_id = old.id AND old.code = '1.2.002' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.simulation_lines sl SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.05'
WHERE sl.account_id = old.id AND old.code = '1.2.002' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
UPDATE public.account_mappings m SET account_id = nw.id
FROM public.accounts old JOIN public.accounts nw ON nw.company_id = old.company_id AND nw.code = '1.05'
WHERE m.account_id = old.id AND m.company_id = old.company_id AND old.code = '1.2.002' AND old.company_id IN (SELECT id FROM tgt) AND old.company_id IN (SELECT id FROM public.companies WHERE slug = 'render-comex');
-- Remove o plano antigo; contas ainda usadas por lançamentos/simulações são preservadas.
UPDATE public.account_mappings SET account_id = NULL
WHERE account_id IN (SELECT a.id FROM public.accounts a JOIN public.account_subgroups sg ON sg.id = a.subgroup_id WHERE sg.code LIKE 'X%' AND sg.company_id IN (SELECT id FROM tgt))
  AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.account_id = account_mappings.account_id);
DELETE FROM public.accounts a USING public.account_subgroups sg
WHERE sg.id = a.subgroup_id AND sg.code LIKE 'X%' AND sg.company_id IN (SELECT id FROM tgt)
  AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.simulation_lines sl WHERE sl.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.account_mappings m WHERE m.account_id = a.id);
DELETE FROM public.account_subgroups sg
WHERE sg.code LIKE 'X%' AND sg.company_id IN (SELECT id FROM tgt)
  AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.subgroup_id = sg.id);
DELETE FROM public.account_groups ag
WHERE ag.code LIKE 'X%' AND ag.company_id IN (SELECT id FROM tgt)
  AND NOT EXISTS (SELECT 1 FROM public.account_subgroups sg WHERE sg.group_id = ag.id);
DROP TABLE pg_temp.tgt;
