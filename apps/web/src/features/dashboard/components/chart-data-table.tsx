/**
 * The text alternative for a chart. Visually hidden, but present in the
 * accessibility tree and in the e2e a11y assertions, so a chart never depends
 * on SVG geometry to communicate its numbers.
 */
export function ChartDataTable({
  caption,
  rows,
}: {
  caption: string
  rows: Array<{ label: string; count: number }>
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
