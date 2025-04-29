/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/format'], function(serverWidget, search, runtime, format) {
    function onRequest(context) {
        if (context.request.method === 'GET') {

            try{
                var params = context.request.parameters;
                var reportId = params.rid;
                log.debug('reportId', reportId);
                var accPeriod = params.acp;
                log.debug('accPeriod', accPeriod);
                var showInForeignCurrency = params.sil;
                log.debug('showInForeignCurrency', showInForeignCurrency);
                var filerBy = params.fb || '1';
                log.debug('filerBy', filerBy);
                var fromDate = params.fd;
                log.debug('fromDate', fromDate);
                var toDate = params.td;
                log.debug('toDate', toDate);
                var subsid = params.sb;
                log.debug('subsid', subsid);

                var scriptObj = runtime.getCurrentScript();
                var tbReportId = scriptObj.getParameter({name: 'custscript_mul_ss_trail_balance_report'});
                var bsReportId = scriptObj.getParameter({name: 'custscript_mul_ss_balance_sheet_report'});
                var plReportId = scriptObj.getParameter({name: 'custscript_mul_ss_profit_loss_report'});
                var retEarningSrchId = scriptObj.getParameter({name: 'custscript_mul_ss_retained_earnings'});

                var form = serverWidget.createForm({
                    title: 'TB/BS and P&L'
                });
                form.clientScriptModulePath = 'SuiteScripts/MUL_CL_Finance_Reports.js';
                var select = form.addField({
                    id: 'custpage_report',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Select Report'
                });
                select.isMandatory = true;
                select.addSelectOption({
                    value: '1',
                    text: reportLabels[tbReportId]
                });
                select.addSelectOption({
                    value: '2',
                    text: reportLabels[bsReportId]
                });
                select.addSelectOption({
                    value: '3',
                    text: reportLabels[plReportId]
                });

                var filterByField = form.addField({
                    id: 'custpage_filter_by',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Filter By'
                });
                filterByField.addSelectOption({ value: '1', text: 'Period' });
                filterByField.addSelectOption({ value: '2', text: 'Date Range' });
                filterByField.updateDisplayType({displayType : serverWidget.FieldDisplayType.DISABLED});
                filterByField.defaultValue = filerBy;
                
                var periodFld = form.addField({
                    id: 'custpage_account_period',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Period(As of)',
                    source: 'accountingperiod'
                });
                periodFld.updateBreakType({
                    breakType : serverWidget.FieldBreakType.STARTROW
                });
                if(accPeriod){
                    periodFld.defaultValue = accPeriod;
                }

                var fromDateFld = form.addField({
                    id: 'custpage_from_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'From Date'
                });
                fromDateFld.updateBreakType({
                    breakType : serverWidget.FieldBreakType.STARTROW
                });
                if(fromDate){
                    fromDateFld.defaultValue = fromDate;
                }
                var toDateFld = form.addField({
                    id: 'custpage_to_date',
                    type: serverWidget.FieldType.DATE,
                    label: 'To Date'
                })
                if(toDate){
                    toDateFld.defaultValue = toDate;
                }

                if(filerBy == '2'){
                    periodFld.updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.NODISPLAY
                    });
                }else{
                    fromDateFld.updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.NODISPLAY
                    });
                    toDateFld.updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.NODISPLAY
                    });
                }
                

                var showInForeignCurrencyFld = form.addField({
                    id: 'custpage_local_currency',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Show in Foreign Currency'
                });

                var subsidiaryFld = form.addField({
                    id: 'custpage_subsidiary',
                    type: serverWidget.FieldType.MULTISELECT,
                    label: 'Subsidiary',
                    source: 'subsidiary'
                });
                if(subsid){
                    subsidiaryFld.defaultValue = subsid.split(',');
                }

                form.addButton({
                    id : 'custpage_load_report',
                    label : 'Load Report',
                    functionName: 'loadReport();'
                });

                if(showInForeignCurrency){
                    showInForeignCurrencyFld.defaultValue = showInForeignCurrency;
                }
                var periodStartDate = '';
                var periodEndDate = '';
                if(accPeriod){
                    var fieldLookUp = search.lookupFields({
                        type: 'accountingperiod',
                        id: accPeriod,
                        columns: ['startdate', 'enddate']
                    });
                    periodStartDate = fieldLookUp ? fieldLookUp.startdate : '';
                    periodEndDate = fieldLookUp ? fieldLookUp.enddate : '';
                }
                //log.debug('periodEndDate', periodEndDate);
                if(reportId){
                    form.addButton({
                        id : 'custpage_download_report',
                        label : 'Download Report',
                        functionName: 'downLoadReport();'
                    });
                    select.defaultValue = reportId;
                    var resultsObj = {};
                    var retErningsObj = {};
                    if(reportId == bsReportId || reportId == tbReportId){
                        //getting retained earnings
                        retErningsObj = getRetainedEarnings(search.load({id: retEarningSrchId}), filerBy, periodEndDate, toDate, subsid, showInForeignCurrency);
                    }
                        
                    if(reportId == tbReportId){
                        var bsResults = getSearchResults(search.load({id: bsReportId}), filerBy, periodStartDate, periodEndDate, fromDate, toDate, subsid, showInForeignCurrency, 'Balance Sheet');
                        var plResults = getSearchResults(search.load({id: plReportId}), filerBy, periodStartDate, periodEndDate, fromDate, toDate, subsid, showInForeignCurrency, 'Profit & Loss');
                        resultsObj = groupResults(bsResults.concat(plResults));
                        if(retErningsObj){
                            for(var subsid in retErningsObj){
                                if(!resultsObj.results['340-000_ Net Income__Equity'][subsid]){
                                    resultsObj.results['340-000_ Net Income__Equity'][subsid] = 0;
                                }
                                if(!retErningsObj[subsid]['340-000_ Net Income__Equity']){
                                    retErningsObj[subsid]['340-000_ Net Income__Equity'] = 0;
                                }
                                resultsObj.results['340-000_ Net Income__Equity'][subsid] += parseFloat(retErningsObj[subsid]['340-000_ Net Income__Equity']);
                                resultsObj.totalObj[subsid] += parseFloat(retErningsObj[subsid]['340-000_ Net Income__Equity']);
                            }
                        }
                    }else{
                        resultsObj = groupResults(getSearchResults(search.load({id: reportId}), filerBy, periodStartDate, periodEndDate, fromDate, toDate, subsid, showInForeignCurrency, reportLabels[reportId]));
                    }
                    var subsidiaries = resultsObj.subsidiaries;
                    var results = resultsObj.results;
                    var currencies = resultsObj.currencies;
                    var totalObj = resultsObj.totalObj;
                    //log.debug('totalObj', totalObj);
                    //log.debug('subsidiaries length', subsidiaries.length);
                    if(subsidiaries.length > 0){
                        var sublist = form.addSublist({
                            id : 'custpage_report_sublist',
                            type : serverWidget.SublistType.LIST,
                            label : reportLabels[reportId]
                        });
                        sublist.addField({
                            id: 'custpage_account_type',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Category'
                        });
                        sublist.addField({
                            id: 'custpage_account',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Account'
                        });
                        for(var s=0; s<subsidiaries.length; s++){
                            //log.debug('subsidiaries[s]', subsidiaries[s]);
                            if(showInForeignCurrency == 'T'){
                                sublist.addField({
                                    id: 'custpage_subsidiary_usd_'+subsidiaries[s].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                    type: serverWidget.FieldType.TEXT,
                                    label: subsidiaries[s]+'<br/>(USD)'
                                });
                            }else{
                                sublist.addField({
                                    id: 'custpage_subsidiary_'+subsidiaries[s].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                    type: serverWidget.FieldType.TEXT,
                                    label: subsidiaries[s]+'<br/>('+currencies[subsidiaries[s]]+')'
                                });
                            }
                        }

                        var netIncomeObj = {};
                        
                        var lineNum = 0;
                        for(var acct in results){
                            if(reportId == bsReportId && acct == '340-000_ Net Income__Equity'){
                                netIncomeObj = results[acct];
                                continue;
                            }
                            var resObj = results[acct];
                            //log.debug('acct', acct);
                            sublist.setSublistValue({
                                id: 'custpage_account_type',
                                line: lineNum,
                                value: acct.split('__')[1]
                            });
                            sublist.setSublistValue({
                                id: 'custpage_account',
                                line: lineNum,
                                value: acct.split('__')[0]
                            });
                            for(var subsi in resObj){
                                if(showInForeignCurrency == 'T'){
                                    var usdAmount = parseFloat(resObj[subsi]).toFixed(2);
                                    if(usdAmount == 0){
                                        usdAmount = parseFloat(0).toFixed(2);
                                    }
                                    sublist.setSublistValue({
                                        id: 'custpage_subsidiary_usd_'+subsi.toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                        line: lineNum,
                                        value: usdAmount
                                    });
                                }else{
                                    var transAmount = parseFloat(resObj[subsi]).toFixed(2);
                                    if(transAmount == 0){
                                        transAmount = parseFloat(0).toFixed(2);
                                    }
                                    sublist.setSublistValue({
                                        id: 'custpage_subsidiary_'+subsi.toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                        line: lineNum,
                                        value: transAmount
                                    });
                                }
                            }
                            lineNum++;
                        }
                        if(reportId == bsReportId){
                            //adding Retained Earnings row
                            sublist.setSublistValue({
                                id: 'custpage_account',
                                line: lineNum,
                                value: 'Retained Earnings'
                            });
                            for(var s1=0; s1<subsidiaries.length; s1++){
                                if(showInForeignCurrency == 'T'){
                                    if(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']){
                                        var usdRetaninedEarnigs = parseFloat(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']).toFixed(2);
                                        if(netIncomeObj[subsidiaries[s1]]){
                                            usdRetaninedEarnigs = parseFloat(usdRetaninedEarnigs)+parseFloat(netIncomeObj[subsidiaries[s1]]);
                                        }
                                    }else{
                                        var usdRetaninedEarnigs = parseFloat(0).toFixed(2);
                                    }
                                    sublist.setSublistValue({
                                        id: 'custpage_subsidiary_usd_'+subsidiaries[s1].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                        line: lineNum,
                                        value: usdRetaninedEarnigs
                                    });
                                }else{
                                    if(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']){
                                        var retainedEarnings = parseFloat(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']).toFixed(2);
                                        if(netIncomeObj[subsidiaries[s1]]){
                                            retainedEarnings = parseFloat(retainedEarnings)+parseFloat(netIncomeObj[subsidiaries[s1]]);
                                        }
                                    }else{
                                        var retainedEarnings = parseFloat(0).toFixed(2);
                                    }
                                    sublist.setSublistValue({
                                        id: 'custpage_subsidiary_'+subsidiaries[s1].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                        line: lineNum,
                                        value: parseFloat(retainedEarnings).toFixed(2)
                                    });
                                }
                            }
                            lineNum++;
                            if(reportId == bsReportId){
                                //adding Net income Row
                                sublist.setSublistValue({
                                    id: 'custpage_account',
                                    line: lineNum,
                                    value: 'Net Income'
                                });
                                for(var s1=0; s1<subsidiaries.length; s1++){
                                    if(showInForeignCurrency == 'T'){
                                        var usdAmountTotal = parseFloat(totalObj[subsidiaries[s1]]);
                                        var usdRetaninedEarnigs = 0;
                                        if(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']){
                                            var usdRetaninedEarnigs = parseFloat(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']);
                                        }
                                        var netIncome = usdAmountTotal+usdRetaninedEarnigs;
                                        netIncome = netIncome.toFixed(2);
                                        if(netIncome == 0){
                                            netIncome = parseFloat(0).toFixed(2);
                                        }
                                        sublist.setSublistValue({
                                            id: 'custpage_subsidiary_usd_'+subsidiaries[s1].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                            line: lineNum,
                                            value: netIncome
                                        });
                                    }else{
                                        var amountTotal = parseFloat(totalObj[subsidiaries[s1]]);
                                        var retainedEarnings = 0;
                                        if(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']){
                                            retainedEarnings = parseFloat(retErningsObj[subsidiaries[s1]]['340-000_ Net Income__Equity']);
                                        }
                                        var netIncome = amountTotal+retainedEarnings;
                                        netIncome = netIncome.toFixed(2);
                                        if(netIncome == 0){
                                            netIncome = parseFloat(0).toFixed(2);
                                        }
                                        sublist.setSublistValue({
                                            id: 'custpage_subsidiary_'+subsidiaries[s1].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                            line: lineNum,
                                            value: parseFloat(netIncome).toFixed(2)
                                        });
                                    }
                                }
                                lineNum++
                            }
                        }

                        //adding total row and end
                        sublist.setSublistValue({
                            id: 'custpage_account',
                            line: lineNum,
                            value: '<b>Total</b>'
                        });
                        for(var s1=0; s1<subsidiaries.length; s1++){
                            if(showInForeignCurrency == 'T'){
                                var usdAmountTotal = parseFloat(totalObj[subsidiaries[s1]]).toFixed(2);
                                if(usdAmountTotal == 0){
                                    usdAmountTotal = parseFloat(0).toFixed(2);
                                }
                                
                                sublist.setSublistValue({
                                    id: 'custpage_subsidiary_usd_'+subsidiaries[s1].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                    line: lineNum,
                                    value: '<b>'+usdAmountTotal+'</b>'
                                });
                            }else{
                                var amountTotal = parseFloat(totalObj[subsidiaries[s1]]).toFixed(2);
                                if(amountTotal == 0){
                                    amountTotal = parseFloat(0).toFixed(2);
                                }
                                
                                sublist.setSublistValue({
                                    id: 'custpage_subsidiary_'+subsidiaries[s1].toLowerCase().replace(/[^A-Z0-9]/ig, ""),
                                    line: lineNum,
                                    value: '<b>'+parseFloat(amountTotal).toFixed(2)+'</b>'
                                });
                            }
                        }
                    }
                }
                context.response.writePage(form);
            }catch(e){
                log.error('get error', e.toString());
            } 
        }
        
    }
    
    function getSearchResults(searchObj, filerBy, periodStartDate, periodEndDate, fromDate, toDate, subsid, showInForeignCurrency, reportLabel){
        //log.debug('getSearchResults filerBy :: periodEndDate :: fromDate :: toDate', filerBy+' :: '+periodEndDate+' :: '+fromDate+' :: '+toDate+' :: '+subsid);
        log.debug('reportLabel in getSearchResults', reportLabel);
        var results = [];
        var count = 0;
        var pageSize = 1000;
        var start = 0;

        if(filerBy == '2' && fromDate && toDate){
            searchObj.filters.push(search.createFilter({name: 'startdate', join:'accountingperiod', operator: 'onorafter', values: fromDate}));
            searchObj.filters.push(search.createFilter({name: 'startdate', join:'accountingperiod', operator: 'onorbefore', values: toDate}));
        }
        else{
            if(periodEndDate){
                var fisaclYearDates = getFiscalYearDates(periodEndDate);
                log.debug('fisaclYearDates', fisaclYearDates);
                var fiscalStartDate = fisaclYearDates.start;
                var fiscalEndDate = fisaclYearDates.end;
                
                log.debug('fiscalStartDate', fiscalStartDate);
                log.debug('fiscalEndDate', fiscalEndDate);
                log.debug('periodEndDate', periodEndDate);
                if(reportLabel == 'Trial Balance'){
                    searchObj.filters.push({name: "accounttype", operator: "anyof", values: ["AcctRec", "OthCurrAsset", "Bank", "FixedAsset", "OthAsset", "AcctPay", "CredCard", "OthCurrLiab", "LongTermLiab", "Equity", "NonPosting", "DeferRevenue", "DeferExpense", "UnbilledRec",  "Stat"], isor: false, isnot: false, leftparens: 2, rightparens: 0});
                    searchObj.filters.push({name: "trandate",operator: "onorbefore", values: periodEndDate, isor: true, isnot: false, leftparens: 0, rightparens: 1});
                    searchObj.filters.push({name: "accounttype", operator: "anyof", values: [ "Income", "COGS", "Expense", "OthIncome", "OthExpense" ], isor: false, isnot: false, leftparens: 1, rightparens: 0});
                    searchObj.filters.push({name: "trandate", operator: "within", values: [fiscalStartDate, fiscalEndDate], isor: false, isnot: false, leftparens: 0, rightparens: 2});
                }
                if(reportLabel == 'Balance Sheet'){
                    searchObj.filters.push(search.createFilter({name: 'startdate', join:'accountingperiod', operator: 'onorbefore', values: periodEndDate}));
                }
                if(reportLabel == 'Profit & Loss'){
                    searchObj.filters.push(search.createFilter({name: 'startdate', join:'accountingperiod', operator: 'onorafter', values: periodStartDate}));
                    searchObj.filters.push(search.createFilter({name: 'startdate', join:'accountingperiod', operator: 'onorbefore', values: periodStartDate}));
                }
            }
        }
        if(subsid){
            searchObj.filters.push(search.createFilter({name: 'subsidiary', operator: 'anyof', values: subsid.split(',')}));
        }

        if(showInForeignCurrency == 'T'){
            
            searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({debitfxamount},0)-NVL({creditfxamount},0)",
                    label: "Debit(Foreign Currency)"
                 })
            );
            /*searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({creditfxamount},0)-NVL({debitfxamount},0)",
                    label: "Credit(Foreign Currency)"
                 })
            );*/
        }else{
            searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({debitamount},0)-NVL({creditamount},0)",
                    label: "Debit"
                })
            );
            /*searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({creditamount},0)-NVL({debitamount},0)",
                    label: "Credit"
                 })
            );*/
        }

        //log.debug('searchObj', searchObj);

        do {
            var subresults = searchObj.run().getRange({
                start: start,
                end: start + pageSize
            });

            results = results.concat(subresults);
            count = subresults.length;
            start += pageSize;
        } while (count == pageSize);

        return results;
    }

    function getRetainedEarnings(searchObj, filerBy, periodEndDate, toDate, subsid, showInForeignCurrency){
        log.debug('getRetainedEarnings', 'getRetainedEarnings');
        if(filerBy == '2' && toDate){
            var fiscalYearStartDate = format.format({value: getFiscalYearDates(toDate).start, type: format.Type.DATE});
            log.debug('fiscalYearStartDate date range', fiscalYearStartDate);
            searchObj.filters.push(search.createFilter({name: 'trandate', operator: 'before', values: fiscalYearStartDate}));
        }
        else{
            if(periodEndDate){
                var fiscalYearStartDate = format.format({value: getFiscalYearDates(periodEndDate).start, type: format.Type.DATE});
                log.debug('fiscalYearStartDate period', fiscalYearStartDate);
                searchObj.filters.push(search.createFilter({name: 'enddate', join:'accountingperiod', operator: 'before', values: fiscalYearStartDate}));
            }
        }
        if(subsid){
            searchObj.filters.push(search.createFilter({name: 'subsidiary', operator: 'anyof', values: subsid.split(',')}));
        }

        if(showInForeignCurrency == 'T'){
            
            /*searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({debitfxamount},0)-NVL({creditfxamount},0)",
                    label: "Debit(Foreign Currency)"
                 })
            );*/
            searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({creditfxamount},0)-NVL({debitfxamount},0)",
                    label: "Credit(Foreign Currency)"
                 })
            );
        }else{
            /*searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({debitamount},0)-NVL({creditamount},0)",
                    label: "Debit"
                })
            );*/
            searchObj.columns.push(
                search.createColumn({
                    name: "formulacurrency",
                    summary: "SUM",
                    formula: "NVL({creditamount},0)-NVL({debitamount},0)",
                    label: "Credit"
                 })
            );
        }
        var results = searchObj.run().getRange({
            start: 0,
            end: 1000
        });
        log.debug('RE results length', results.length);

        var reObj = {};
        for(var r=0; r<results.length; r++){
            var res = results[r];
            var subsidiaryName = res.getValue(res.columns[0]);
            if(subsidiaryName.indexOf('Multiplier Technologies (China) Limited Company') != -1){
                subsidiaryName = 'Multiplier Technologies (China) Limited Company';
            }
            var balance = res.getValue(res.columns[1]) || 0;
            if(!reObj.hasOwnProperty(subsidiaryName)){
                reObj[subsidiaryName] = {};
                reObj[subsidiaryName]['340-000_ Net Income__Equity'] = 0;
            }
            reObj[subsidiaryName]['340-000_ Net Income__Equity'] += parseFloat(balance);
        }
        log.debug('reObj', reObj);

        return reObj;
    }

    function groupResults(results){
        //log.debug('groupResults results', results);
        var obj = {};
        obj.results = {};
        obj.subsidiaries = [];
        obj.currencies = {};
        obj.totalObj = {};
        for(var r=0; r<results.length; r++){
            var res = results[r];
            //log.debug('res '+r, res);
            var accountName = res.getText(res.columns[0]);
            var subsidiaryName = res.getValue(res.columns[1]);
            var currSymbol = res.getText(res.columns[2]);
            var accountType = res.getText(res.columns[3]);
            var balance = res.getValue(res.columns[4]) || 0;
            //log.debug('balance', balance);

            if(subsidiaryName.indexOf('Multiplier Technologies (China) Limited Company') != -1){
                subsidiaryName = 'Multiplier Technologies (China) Limited Company';
            }
            if(obj.subsidiaries.indexOf(subsidiaryName) == -1){
                obj.subsidiaries.push(subsidiaryName);
                obj.currencies[subsidiaryName] = currSymbol;
                obj.totalObj[subsidiaryName] = 0;
            }
            if(!obj.results.hasOwnProperty(accountName+'__'+accountType)){
                obj.results[accountName+'__'+accountType] = {};
            }
            if(!obj.results[accountName+'__'+accountType].hasOwnProperty(subsidiaryName)){
                obj.results[accountName+'__'+accountType][subsidiaryName] = 0;
            }
            obj.results[accountName+'__'+accountType][subsidiaryName] += parseFloat(balance);
            obj.totalObj[subsidiaryName] += parseFloat(balance);
            //log.debug('accountName__accountType', accountName+'__'+accountType);
        }
        //log.debug('groupResults obj', obj);
        return obj;
    }

    function getFiscalYearDates(date) {
        const fiscalStartMonth = 3;
        const endDate = format.parse({value: new Date(date), type: format.Type.DATE});
        const endDateYear = endDate.getFullYear();
      
        // Determine fiscal year start
        const fiscalStartThisYear = new Date(endDateYear, fiscalStartMonth, 1);
      
        let fiscalYearStart, fiscalYearEnd;
      
        if (endDate >= fiscalStartThisYear) {
          fiscalYearStart = fiscalStartThisYear;
          fiscalYearEnd = new Date(endDateYear + 1, fiscalStartMonth, 0); // Last day of previous month (next fiscal start - 1)
        } else {
          fiscalYearStart = new Date(endDateYear - 1, fiscalStartMonth, 1);
          fiscalYearEnd = new Date(endDateYear, fiscalStartMonth, 0);
        }

        fiscalYearStart = format.format({value: fiscalYearStart, type: format.Type.DATE});
        fiscalYearEnd = format.format({value: fiscalYearEnd, type: format.Type.DATE});
      
        return {
          start: fiscalYearStart,
          end: fiscalYearEnd
        };
    }

    return {
        onRequest: onRequest
    };
});