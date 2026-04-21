import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../database/entities/client.entity';
import { Developer } from '../../database/entities/developer.entity';
import { Project } from '../../database/entities/project.entity';
import { Milestone } from '../../database/entities/milestone.entity';
import { Rating } from '../../database/entities/rating.entity';

/**
 * Seeds the SQLite database with realistic test data on first startup.
 * Only runs when USE_MOCK_AUTH=true and the database is empty.
 *
 * Addresses and contract addresses must match the mock-api seed in
 * packages/mock-api/src/seed.ts so cross-references work.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Developer) private developerRepo: Repository<Developer>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Milestone) private milestoneRepo: Repository<Milestone>,
    @InjectRepository(Rating) private ratingRepo: Repository<Rating>,
  ) {}

  async onModuleInit() {
    if (process.env.USE_MOCK_AUTH !== 'true') return;

    const clientCount = await this.clientRepo.count();
    if (clientCount > 0) {
      this.logger.log('Database already has data, skipping seed');
      return;
    }

    this.logger.log('Seeding database with test data...');
    await this.seed();
    this.logger.log('Seed complete');
  }

  private async seed() {
    // ── Clients ──────────────────────────────────────────────────────
    const alice = await this.clientRepo.save(this.clientRepo.create({
      email: 'alice@example.com',
      name: 'Alice Johnson',
      company: 'Acme DeFi',
      department: 'Product',
      website: 'https://acme-defi.example.com',
      description: 'Building next-generation decentralized finance tools for everyday users.',
      location: 'San Francisco, USA',
      languages: ['ENG', 'SPA'],
    }));

    const bob = await this.clientRepo.save(this.clientRepo.create({
      email: 'bob@example.com',
      name: 'Bob Martinez',
      company: 'ChainGuard',
      department: 'Engineering',
      website: 'https://chainguard.example.com',
      description: 'Enterprise blockchain security and auditing firm.',
      location: 'Berlin, Germany',
      languages: ['ENG', 'DEU'],
    }));

    // ── Developers ──────────────────────────────────────────────────
    const carol = await this.developerRepo.save(this.developerRepo.create({
      email: 'carol@example.com',
      name: 'Carol Chen',
      githubUsername: 'carolchen',
      portfolioUrl: 'https://carolchen.dev',
      bio: 'Full-stack blockchain developer with 6 years of experience in Substrate and ink! smart contracts.',
      background: 'Previously at Parity Technologies. Core contributor to several Polkadot ecosystem projects.',
      proficiency: 'senior',
      role: 'Full Stack',
      location: 'Taipei, Taiwan',
      availability: 'FullTime',
      availableHoursPerWeek: 40,
      languages: ['ENG', 'CMN'],
      skills: ['Rust', 'Javascript', 'Node'],
    }));

    const dave = await this.developerRepo.save(this.developerRepo.create({
      email: 'dave@example.com',
      name: 'Dave Kim',
      githubUsername: 'davekim',
      portfolioUrl: 'https://davekim.io',
      bio: 'Frontend specialist passionate about creating intuitive Web3 user experiences.',
      background: 'Led frontend teams at two DeFi startups. Expert in React, TypeScript and wallet integrations.',
      proficiency: 'mid-level',
      role: 'Front End',
      location: 'Seoul, South Korea',
      availability: 'PartTime',
      availableHoursPerWeek: 20,
      languages: ['ENG', 'KOR'],
      skills: ['Javascript', 'HTML5', 'UX'],
    }));

    const eve = await this.developerRepo.save(this.developerRepo.create({
      email: 'eve@example.com',
      name: 'Eve Santos',
      githubUsername: 'evesantos',
      portfolioUrl: 'https://evesantos.dev',
      bio: 'Backend engineer focused on smart contract development and security auditing.',
      background: 'Smart contract auditor with experience in ink!, Solidity, and formal verification.',
      proficiency: 'senior',
      role: 'BackEnd',
      location: 'Lisbon, Portugal',
      availability: 'WeeklyHours',
      availableHoursPerWeek: 32,
      languages: ['ENG', 'POR', 'SPA'],
      skills: ['Rust', 'Node'],
    }));

    // ── Contract addresses (must match mock-api/src/seed.ts) ────────
    const contracts = {
      defiDashboard: '5Ck5SLSHYac6WFt5UZRSsdJjwmpSZq85fd5TRNAdZQVzEAPT',
      nftMarketplace: '5HpG9w8EBLe5XCrbczpwq5TSXvedjrBGCwqxK1iQ7qUsSWFc',
      mobileWallet: '5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z',
      contractAudit: '5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSneWj5VDnQU',
      calendar: '5Dd34LSU53MLwJpq4wfHmDFwAifJrcaPbd1qTCGZcR7iXQkd',
    };

    // ── Project 1: DeFi Dashboard (deployed, coordinator assigned) ──
    const p1 = await this.projectRepo.save(this.projectRepo.create({
      title: 'DeFi Dashboard',
      summary: 'A unified dashboard for managing DeFi positions across multiple protocols.',
      description: 'Build an intuitive dashboard that aggregates DeFi positions, shows portfolio performance, and enables one-click interactions with lending, staking, and LP protocols on Polkadot.',
      projectType: 2, // Frontend
      state: 'deployed',
      budget: 15000,
      deliveryTime: 2, // 1-3 months
      clientId: alice.id.toString(),
      consultantId: carol.id.toString(),
      contractAddress: contracts.defiDashboard,
      calendarContract: contracts.calendar,
      creationStatus: 'created',
    }));

    // ── Project 2: NFT Marketplace (scope proposed, with milestones) ──
    const p2 = await this.projectRepo.save(this.projectRepo.create({
      title: 'NFT Marketplace',
      summary: 'A decentralized marketplace for minting, trading, and showcasing NFTs.',
      description: 'Create a full-featured NFT marketplace with lazy minting, auctions, collections, and creator royalties. Built on Substrate with ink! smart contracts.',
      projectType: 3, // MVP
      state: 'scope_proposed',
      budget: 35000,
      deliveryTime: 3, // 3-6 months
      clientId: alice.id.toString(),
      consultantId: carol.id.toString(),
      contractAddress: contracts.nftMarketplace,
      calendarContract: contracts.calendar,
      creationStatus: 'created',
      coordinatorApprovalStatus: 'approved',
    }));

    // Milestones for NFT Marketplace
    await this.milestoneRepo.save([
      this.milestoneRepo.create({
        title: 'Smart Contract Development',
        description: 'Develop ink! smart contracts for NFT minting, transfers, auctions, and royalty distribution.',
        budget: 3000,
        deliveryTime: 15,
        role: 'BackEnd',
        proficiency: 'senior',
        skills: ['Rust'],
        contractAddress: contracts.nftMarketplace,
        displayOrder: 0,
        state: 'pending',
        neededFullTimeDeveloper: true,
      }),
      this.milestoneRepo.create({
        title: 'Frontend Marketplace UI',
        description: 'Build the React frontend for browsing, minting, and trading NFTs with wallet integration.',
        budget: 5000,
        deliveryTime: 20,
        role: 'Front End',
        proficiency: 'mid-level',
        skills: ['Javascript', 'HTML5', 'UX'],
        contractAddress: contracts.nftMarketplace,
        displayOrder: 1,
        state: 'pending',
        neededFullTimeDeveloper: true,
      }),
      this.milestoneRepo.create({
        title: 'Testing & Deployment',
        description: 'End-to-end testing, security review, and deployment to testnet.',
        budget: 2000,
        deliveryTime: 10,
        role: 'Full Stack',
        proficiency: 'senior',
        skills: ['Rust', 'Javascript'],
        contractAddress: contracts.nftMarketplace,
        displayOrder: 2,
        state: 'pending',
        neededFullTimeDeveloper: false,
        neededPartTimeDeveloper: true,
      }),
    ]);

    // ── Project 3: Mobile Wallet (team assigned, in progress) ───────
    const p3 = await this.projectRepo.save(this.projectRepo.create({
      title: 'Mobile Wallet App',
      summary: 'A mobile-first crypto wallet for Polkadot ecosystem tokens.',
      description: 'Design and build a React Native mobile wallet supporting KSM, DOT, and parachain tokens. Features include biometric auth, QR scanning, staking, and dApp browser.',
      projectType: 5, // Mobile App
      state: 'team_assigned',
      budget: 50000,
      deliveryTime: 3, // 3-6 months
      clientId: bob.id.toString(),
      consultantId: carol.id.toString(),
      contractAddress: contracts.mobileWallet,
      calendarContract: contracts.calendar,
      creationStatus: 'created',
      coordinatorApprovalStatus: 'approved',
    }));

    // Milestones for Mobile Wallet — various states to test the kanban board
    await this.milestoneRepo.save([
      this.milestoneRepo.create({
        title: 'Wallet Core & Key Management',
        description: 'Implement HD wallet derivation, secure key storage, and transaction signing for Substrate-based chains.',
        budget: 4000,
        deliveryTime: 10,
        role: 'BackEnd',
        proficiency: 'senior',
        skills: ['Rust', 'Node'],
        contractAddress: contracts.mobileWallet,
        displayOrder: 0,
        state: 'completed',
        developerId: dave.id,
        neededFullTimeDeveloper: true,
      }),
      this.milestoneRepo.create({
        title: 'UI/UX & Token Dashboard',
        description: 'Build the mobile UI for token balances, transaction history, and portfolio overview.',
        budget: 6000,
        deliveryTime: 15,
        role: 'Front End',
        proficiency: 'mid-level',
        skills: ['Javascript', 'HTML5', 'UX'],
        contractAddress: contracts.mobileWallet,
        displayOrder: 1,
        state: 'in_review',
        developerId: dave.id,
        neededFullTimeDeveloper: true,
      }),
      this.milestoneRepo.create({
        title: 'Staking & dApp Browser',
        description: 'Implement staking functionality and an embedded dApp browser for interacting with parachains.',
        budget: 8000,
        deliveryTime: 20,
        role: 'Full Stack',
        proficiency: 'senior',
        skills: ['Rust', 'Javascript', 'Node'],
        contractAddress: contracts.mobileWallet,
        displayOrder: 2,
        state: 'task_in_progress',
        developerId: eve.id,
        neededFullTimeDeveloper: true,
      }),
    ]);

    // ── Project 4: Smart Contract Audit (completed, with ratings) ───
    const p4 = await this.projectRepo.save(this.projectRepo.create({
      title: 'Smart Contract Security Audit',
      summary: 'Comprehensive security audit of ink! smart contracts.',
      description: 'Perform a thorough security audit of a DeFi protocol\'s ink! smart contracts including static analysis, manual review, and fuzzing. Deliver a detailed report with findings and recommendations.',
      projectType: 4, // Audit
      state: 'completed',
      budget: 25000,
      deliveryTime: 2, // 1-3 months
      deliveryDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // completed 1 week ago
      clientId: bob.id.toString(),
      consultantId: carol.id.toString(),
      contractAddress: contracts.contractAudit,
      calendarContract: contracts.calendar,
      creationStatus: 'created',
      coordinatorApprovalStatus: 'approved',
    }));

    // Milestones for Audit — all completed
    await this.milestoneRepo.save([
      this.milestoneRepo.create({
        title: 'Static Analysis & Automated Scanning',
        description: 'Run automated tools (cargo-audit, clippy, ink! analyzer) and document initial findings.',
        budget: 5000,
        deliveryTime: 10,
        role: 'BackEnd',
        proficiency: 'senior',
        skills: ['Rust'],
        contractAddress: contracts.contractAudit,
        displayOrder: 0,
        state: 'completed',
        developerId: dave.id,
        neededFullTimeDeveloper: true,
      }),
      this.milestoneRepo.create({
        title: 'Manual Review & Final Report',
        description: 'Perform line-by-line manual code review, write the final audit report with severity ratings and remediation steps.',
        budget: 7000,
        deliveryTime: 15,
        role: 'BackEnd',
        proficiency: 'senior',
        skills: ['Rust'],
        contractAddress: contracts.contractAudit,
        displayOrder: 1,
        state: 'completed',
        developerId: dave.id,
        neededFullTimeDeveloper: true,
      }),
    ]);

    // ── Ratings for the completed audit project ─────────────────────
    await this.ratingRepo.save([
      this.ratingRepo.create({
        projectId: p4.id,
        clientId: bob.id.toString(),
        developerId: carol.id.toString(),
        rating: 9,
        contractAddress: contracts.contractAudit,
      }),
      this.ratingRepo.create({
        projectId: p4.id,
        clientId: bob.id.toString(),
        developerId: dave.id.toString(),
        rating: 8,
        contractAddress: contracts.contractAudit,
      }),
    ]);

    this.logger.log(`Seeded: ${[alice, bob].length} clients, ${[carol, dave, eve].length} developers, 4 projects`);
  }
}
