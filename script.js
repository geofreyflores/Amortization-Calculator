(function(angular) {
  'use strict';
  angular.module('amortApp', [])
  
  /** Calculations from http://www.vertex42.com/ExcelArticles/amortization-calculation.html */
  .factory("amortSvc", [function() {
    return {
      calcPayments : function(principal, periodRate, numPeriods) {
        if (periodRate === 0) { return principal / numPeriods; } // no interest
        
        // formula: A = P * [ r * (1+r)^n / (1+r)^n - 1]
        var r = Math.pow(1 + periodRate, numPeriods); // (1+r)^n;
        r = (periodRate * r) / (r - 1);
        return principal * r;
      },
      
      getPeriodRate : function(annualRate, compPeriod, yrFreq) {
        // formula: r = [(1+annualRate/compPeriod)^(compPeriod/yrFreq)] - 1
        annualRate = annualRate / 100;
        var r = 1 + (annualRate / compPeriod); // (1+i/n)
        return Math.pow(r, compPeriod/yrFreq) - 1;
      },
      
      createPayment : function(paymentAmt, prevBalance, periodRate, index) {
        var interest = periodRate * prevBalance;
        if (interest + prevBalance < paymentAmt) { // last payment could be less than paymentAmt
          paymentAmt = prevBalance + interest; // < old paymentAmt; need to update
        }
        var principal = paymentAmt - interest;
        var balance = prevBalance - principal;
        
        return {
          paymentIndex : index,
          amount : paymentAmt,
          interest : interest,
          principal : principal,
          balance : balance
        };
      }
      
    }
  }])
  
  .controller('amortCtrl', ['$scope', '$filter', '$log', 'amortSvc', 
  function($scope, $filter, $log, amortSvc) {
    $scope.debounce = 500;
    $scope.yrFrequency = [
      { text : "Annual", value : 1}, 
      { text : "Semi-annual", value : 2}, 
      { text : "Quarterly", value : 4},
      { text : "Bi-monthly", value : 6}, 
      { text : "Monthly", value : 12}, 
      { text : "Semi-monthly", value : 24},
      { text : "Bi-weekly", value : 26}, 
      { text : "Weekly", value : 52}
    ];
    
    $scope.inputFields = {
      principal : { label : "Loan Amount" , type : "NUMBER", value : 10000},
      annualRate : { label : "Annual Interest Rate (%)" , type : "NUMBER", value : 5.00},
      loanTerm : { label : "Length of term in Years" , type : "NUMBER", value : 1},
      freq : {label : "Payment Frequency", type : "SELECT", options : $scope.yrFrequency, value : 12 },
      compPeriod : { label : "Compound Period (optional)" , type : "SELECT", options : $scope.yrFrequency, value : 12 },
    };
    
    // hold computed values
    $scope.info = { numPeriods : 0, frequencyTxt : "", payments : [] };
    
    
    /* Change frequency text and compound period to sync with payment frequency */
    $scope.$watch("inputFields.freq.value", function(newFreq) {
      var filterFreq = $filter('filter').bind(null, $scope.yrFrequency);
      
      $scope.info.frequencyTxt = filterFreq(function(opt) { return opt.value === newFreq; })[0].text;
      
      // compPeriod should always be less than (longer) than payment frequency; adjust dropdown
      $scope.inputFields.compPeriod.options = filterFreq(function(opt) { return opt.value <= newFreq; });
      $scope.inputFields.compPeriod.value = (12 < newFreq) ? 12 : newFreq;
    });
          
    /* update numPeriods whenever loan term or payment frequency changes */
    $scope.$watchGroup(["inputFields.loanTerm.value", "inputFields.freq.value"], function() {
      $scope.info.numPeriods = $scope.inputFields.loanTerm.value * $scope.inputFields.freq.value || 0;
    });
    
    /* recalculate period payment whenver any of the listed variables change */
    $scope.$watchGroup([
      "inputFields.principal.value"
      ,"info.numPeriods"
      ,"inputFields.annualRate.value"
      ,"inputFields.compPeriod.value"
      ,"inputFields.freq.value"], 
    function() {
      var principal = $scope.inputFields.principal.value
        , numPeriods = $scope.info.numPeriods
        , annualRate = $scope.inputFields.annualRate.value
        , compPeriod = $scope.inputFields.compPeriod.value
        , yrFreq = $scope.inputFields.freq.value;
      
      // update info
      var periodRate = amortSvc.getPeriodRate(annualRate, compPeriod, yrFreq);
      $scope.info.paymentAmt = amortSvc.calcPayments(principal, periodRate, numPeriods);
      $scope.info.totalPayment = $scope.info.paymentAmt * numPeriods;
      $scope.info.totalInterest = $scope.info.totalPayment - principal;
      $scope.info.totalIntPercentage = $scope.info.totalInterest / principal * 100;
      
      // used for comparing with monthly payments
      var monthlyRate = amortSvc.getPeriodRate(annualRate, compPeriod, 12);
      var monthlyPeriods = $scope.inputFields.loanTerm.value * 12;
      var monthlyAmt = amortSvc.calcPayments(principal, monthlyRate, monthlyPeriods);
      var totalPaymentMonthly = monthlyAmt * monthlyPeriods;
      $scope.info.monthlyPayment = $scope.info.paymentAmt * yrFreq / 12;
      $scope.info.savingsPerYr = (monthlyAmt - $scope.info.monthlyPayment) * 12;
      
      // update table; recalculate row payments
      var balance = principal, index = 1, payment;
      $scope.info.payments = [{
        paymentIndex : null, amount : null, interest : null,
        principal : null, balance : balance
      }];
      while (Math.round(balance * 100) / 100 > 0) { // round off balance
        payment = amortSvc.createPayment($scope.info.paymentAmt, balance, periodRate, index);
        balance = payment.balance; ++index;
        $scope.info.payments.push(payment);
      }
    });
    
  }]);
})(window.angular);
