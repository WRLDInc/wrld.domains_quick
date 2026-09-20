const STEPS = [
  {
    num: '01',
    title: 'Search',
    body: 'Type a name. We check it live through WRLD.host and show the same label across popular TLDs, so you can compare before you commit.',
  },
  {
    num: '02',
    title: 'Register',
    body: 'Checkout runs on WRLD.host, the platform WRLD runs itself. One account covers your domains, hosting, SSL, and tickets.',
  },
  {
    num: '03',
    title: 'Point it',
    body: 'Manage nameservers, DNS records, contacts, and renewals from the client area. Bring existing domains over whenever you’re ready.',
  },
];

/** Numbered strip after ui_kits/wrld-tech/ValuesStrip.jsx. Text-led, no icons. */
export function HowItWorks() {
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">How it works</div>
            <h2 id="how-title" className="section-title">
              Three steps, one account, no reseller in between.
            </h2>
          </div>
          <p className="lede">
            The search here and the checkout on WRLD.host are the same system, so what you see is what you
            register.
          </p>
        </div>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.num} className="step">
              <div className="step-num">{step.num}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
