-- AlterEnum
-- El ADD VALUE va en su PROPIA migración: PostgreSQL no permite usar un valor de
-- enum recién agregado dentro de la misma transacción que lo crea. La tabla y todo
-- lo que lo usa va en la migración siguiente (20260627000000_add_people_search).
ALTER TYPE "SourceType" ADD VALUE 'missing_persons';
