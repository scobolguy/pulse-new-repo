      IDENTIFICATION DIVISION.
      PROGRAM-ID. FEE-CALC.
      DATA DIVISION.
      WORKING-STORAGE SECTION.
      01 PRICE      PIC S9(7)V99.
      01 QTY        PIC 9(3).
      01 GROSS      PIC S9(9)V99.
      01 FEE        PIC S9(9)V99.
      01 FEE-ROUND  PIC S9(9)V99.
      01 TOTAL      PIC S9(9)V99.
      01 SMALL      PIC 9(2)V9.
      01 GRADE      PIC X(10).
      PROCEDURE DIVISION.
          MOVE 19.99 TO PRICE.
          MOVE 3 TO QTY.

          COMPUTE GROSS = PRICE * QTY.
          DISPLAY "gross " GROSS.

          COMPUTE FEE = GROSS * 0.125.
          COMPUTE FEE-ROUND ROUNDED = GROSS * 0.125.
          DISPLAY "fee trunc " FEE.
          DISPLAY "fee round " FEE-ROUND.

          MOVE GROSS TO TOTAL.
          ADD FEE-ROUND TO TOTAL.
          DISPLAY "total " TOTAL.

          IF TOTAL > 60 THEN
              DISPLAY "band high"
          ELSE
              DISPLAY "band low"
          END-IF.

          IF TOTAL > 1000 THEN
              DISPLAY "wrong"
          ELSE
              DISPLAY "band ok"
          END-IF.

          COMPUTE SMALL = 99.9 ON SIZE ERROR DISPLAY "overflow".
          DISPLAY "small " SMALL.

          COMPUTE SMALL = 1234.5 ON SIZE ERROR DISPLAY "overflow caught".
          DISPLAY "small " SMALL.

          STOP RUN.
