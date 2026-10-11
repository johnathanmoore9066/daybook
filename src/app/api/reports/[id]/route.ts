import { files, readState, reportFileName } from "@/lib/store";

export async function GET(request: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const { id } = await ctx.params;
  const report = (await readState()).reports.find((r) => r.id === id);
  const file = report ? await files.get(reportFileName(report.id)) : null;
  if (!report || !file) return new Response("Report not found", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  return new Response(file.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${report.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
