import styles from './Team.module.css';

const team = [
  {
    name: 'Tony Riemer',
    role: 'Co-Founder',
    bio: 'Architect of secure systems. Enterprise fintech at Capital One, deep blockchain infrastructure at Ideal Labs. Multiple Web3 Foundation grants. Specializes in translating advanced cryptographic theory into production-ready code.',
    image: '/team/tony.jpg',
    links: {
      linkedin: 'https://www.linkedin.com/in/tony-riemer/',
      github: 'https://github.com/driemworks',
    },
  },
  {
    name: 'Coleman Irby',
    role: 'Co-Founder',
    bio: 'Full stack engineer with a Masters in Physics. Builds the graph and indexing layer. Focused on making encrypted data discoverable without making it accessible.',
    image: '/team/coleman.jpg',
    links: {
      linkedin: 'https://www.linkedin.com/in/coleman-irby',
      github: 'https://github.com/colemanirby',
    },
  },
];

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function Team() {
  return (
    <section className={styles.section} id="team">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.tag}>Team</div>
          {/* <h2 className={styles.h2}>Built by two people who care about the problem.</h2> */}
        </div>
        <p className={styles.headerRight}>
          We're cryptography and systems engineers who got tired of watching platforms extract value from data they don't own. Fangorn is what we wanted to exist.
        </p>
      </div>

      <div className={styles.grid}>
        {team.map((member) => (
          <div key={member.name} className={styles.card}>
            <div className={styles.imgWrap}>
              <div className={styles.imgFallback}>
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <img
                src={member.image}
                alt={member.name}
                className={styles.img}
                onLoad={(e) => { e.target.previousSibling.style.display = 'none'; }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div className={styles.info}>
              <div className={styles.name}>{member.name}</div>
              <div className={styles.role}>{member.role}</div>
              <div className={styles.links}>
                {member.links.github && (
                  <a href={member.links.github} className={styles.iconLink} target="_blank" rel="noreferrer" aria-label="GitHub">
                    <GithubIcon />
                  </a>
                )}
                {member.links.linkedin && (
                  <a href={member.links.linkedin} className={styles.iconLink} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                    <LinkedinIcon />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}