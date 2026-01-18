export type CompletedByTaskNameAggregate = {
  taskName: string;
  tasks: number;
  handlingTimeSum: number;
  handlingTimeCount: number;
  daysBeyondSum: number;
  daysBeyondCount: number;
};
