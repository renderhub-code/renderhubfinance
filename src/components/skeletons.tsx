import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          <div className="flex gap-4 px-4 py-3 bg-muted/40">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-4 px-4 py-3 items-center">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-24" : ""}`} />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MatrixSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        <div className="divide-y">
          <div className="flex gap-2 px-3 py-2 bg-muted/40">
            <Skeleton className="h-4 w-48" />
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16 ml-auto" />
            ))}
            <Skeleton className="h-4 w-20 ml-2" />
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-2 px-3 py-2 items-center">
              <Skeleton className={`h-4 w-48 ${r % 3 === 0 ? "opacity-100" : "opacity-70"}`} />
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-16 ml-auto" />
              ))}
              <Skeleton className="h-4 w-20 ml-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TreeSkeleton({ groups = 5 }: { groups?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {Array.from({ length: groups }).map((_, g) => (
            <div key={g}>
              <div className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-5 w-16 ml-auto rounded-full" />
              </div>
              <div className="pl-10 pb-3 space-y-2">
                {Array.from({ length: 2 }).map((_, s) => (
                  <div key={s} className="flex items-center gap-3">
                    <Skeleton className="h-3.5 w-3.5" />
                    <Skeleton className="h-3.5 w-10" />
                    <Skeleton className="h-3.5 w-40" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
