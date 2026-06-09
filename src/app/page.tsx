export default function Home() {
  return (
    <main style={{ padding: "24px" }}>
      <h1>競艇ROIバックテスト</h1>

      <div style={{ marginTop: "24px" }}>
        <p>総レース数: 1000</p>
        <p>購入点数: 500</p>
        <p>的中率: 18.5%</p>
        <p>投資額: ¥500,000</p>
        <p>払戻額: ¥540,000</p>
        <p>収支: +¥40,000</p>
        <p>ROI: 108.0%</p>
      </div>

      <h2 style={{ marginTop: "32px" }}>
        EV別バックテスト
      </h2>

      <table
        border={1}
        cellPadding={8}
        style={{ marginTop: "12px" }}
      >
        <thead>
          <tr>
            <th>条件</th>
            <th>購入数</th>
            <th>ROI</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>EV &gt; 1.05</td>
            <td>500</td>
            <td>101%</td>
          </tr>
          <tr>
            <td>EV &gt; 1.10</td>
            <td>350</td>
            <td>104%</td>
          </tr>
          <tr>
            <td>EV &gt; 1.15</td>
            <td>180</td>
            <td>108%</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
