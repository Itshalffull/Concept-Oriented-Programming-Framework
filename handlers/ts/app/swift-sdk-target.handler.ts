// SwiftSdkTarget Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const swiftSdkTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const packageName = (parsedConfig.packageName as string) || 'CopfSDK';
    const platforms = (parsedConfig.platforms as string[]) || ['iOS', 'macOS'];

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const typeName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    const modelsFile = [
      `// Generated models for ${typeName}`,
      `import Foundation`,
      ``,
      `/// ${typeName} entity.`,
      `public struct ${typeName}: Codable, Identifiable, Sendable {`,
      `    public let id: String`,
      `    public let name: String`,
      `    public let createdAt: Date`,
      `    public let updatedAt: Date`,
      `}`,
      ``,
      `/// Input for creating a ${typeName}.`,
      `public struct Create${typeName}Input: Codable, Sendable {`,
      `    public let name: String`,
      ``,
      `    public init(name: String) {`,
      `        self.name = name`,
      `    }`,
      `}`,
      ``,
      `/// Input for updating a ${typeName}.`,
      `public struct Update${typeName}Input: Codable, Sendable {`,
      `    public let name: String?`,
      ``,
      `    public init(name: String? = nil) {`,
      `        self.name = name`,
      `    }`,
      `}`,
      ``,
      `/// Result type for ${typeName} operations.`,
      `public enum ${typeName}Result {`,
      `    case success(${typeName})`,
      `    case notFound(String)`,
      `    case error(Error)`,
      `}`,
    ].join('\n');

    const clientFile = [
      `// Generated client for ${typeName}`,
      `import Foundation`,
      ``,
      `/// Client for ${typeName} operations.`,
      `public actor ${typeName}Client {`,
      `    private let baseURL: URL`,
      `    private let session: URLSession`,
      `    private let decoder: JSONDecoder`,
      `    private let encoder: JSONEncoder`,
      ``,
      `    public init(baseURL: URL) {`,
      `        self.baseURL = baseURL`,
      `        self.session = URLSession.shared`,
      `        self.decoder = JSONDecoder()`,
      `        self.decoder.dateDecodingStrategy = .iso8601`,
      `        self.encoder = JSONEncoder()`,
      `        self.encoder.dateEncodingStrategy = .iso8601`,
      `    }`,
      ``,
      `    /// Create a new ${typeName}.`,
      `    public func create(_ input: Create${typeName}Input) async -> Result<${typeName}, Error> {`,
      `        let url = baseURL.appendingPathComponent("${conceptName}")`,
      `        var request = URLRequest(url: url)`,
      `        request.httpMethod = "POST"`,
      `        request.httpBody = try? encoder.encode(input)`,
      `        request.setValue("application/json", forHTTPHeaderField: "Content-Type")`,
      `        do {`,
      `            let (data, _) = try await session.data(for: request)`,
      `            let result = try decoder.decode(${typeName}.self, from: data)`,
      `            return .success(result)`,
      `        } catch {`,
      `            return .failure(error)`,
      `        }`,
      `    }`,
      ``,
      `    /// Get a ${typeName} by ID.`,
      `    public func get(id: String) async -> Result<${typeName}, Error> {`,
      `        let url = baseURL.appendingPathComponent("${conceptName}/\\(id)")`,
      `        do {`,
      `            let (data, _) = try await session.data(from: url)`,
      `            let result = try decoder.decode(${typeName}.self, from: data)`,
      `            return .success(result)`,
      `        } catch {`,
      `            return .failure(error)`,
      `        }`,
      `    }`,
      ``,
      `    /// List all ${typeName} entries.`,
      `    public func list() async -> Result<[${typeName}], Error> {`,
      `        let url = baseURL.appendingPathComponent("${conceptName}")`,
      `        do {`,
      `            let (data, _) = try await session.data(from: url)`,
      `            let result = try decoder.decode([${typeName}].self, from: data)`,
      `            return .success(result)`,
      `        } catch {`,
      `            return .failure(error)`,
      `        }`,
      `    }`,
      ``,
      `    /// Update a ${typeName}.`,
      `    public func update(id: String, input: Update${typeName}Input) async -> Result<${typeName}, Error> {`,
      `        let url = baseURL.appendingPathComponent("${conceptName}/\\(id)")`,
      `        var request = URLRequest(url: url)`,
      `        request.httpMethod = "PUT"`,
      `        request.httpBody = try? encoder.encode(input)`,
      `        request.setValue("application/json", forHTTPHeaderField: "Content-Type")`,
      `        do {`,
      `            let (data, _) = try await session.data(for: request)`,
      `            let result = try decoder.decode(${typeName}.self, from: data)`,
      `            return .success(result)`,
      `        } catch {`,
      `            return .failure(error)`,
      `        }`,
      `    }`,
      ``,
      `    /// Delete a ${typeName}.`,
      `    public func delete(id: String) async -> Result<Void, Error> {`,
      `        let url = baseURL.appendingPathComponent("${conceptName}/\\(id)")`,
      `        var request = URLRequest(url: url)`,
      `        request.httpMethod = "DELETE"`,
      `        do {`,
      `            let (_, _) = try await session.data(for: request)`,
      `            return .success(())`,
      `        } catch {`,
      `            return .failure(error)`,
      `        }`,
      `    }`,
      `}`,
    ].join('\n');

    const platformsFormatted = platforms.map(p => {
      switch (p.toLowerCase()) {
        case 'ios': return `.iOS(.v16)`;
        case 'macos': return `.macOS(.v13)`;
        case 'tvos': return `.tvOS(.v16)`;
        case 'watchos': return `.watchOS(.v9)`;
        default: return `.iOS(.v16)`;
      }
    }).join(', ');

    const packageSwiftFile = [
      `// swift-tools-version:5.9`,
      `import PackageDescription`,
      ``,
      `let package = Package(`,
      `    name: "${packageName}",`,
      `    platforms: [${platformsFormatted}],`,
      `    products: [`,
      `        .library(`,
      `            name: "${packageName}",`,
      `            targets: ["${packageName}"]`,
      `        ),`,
      `    ],`,
      `    targets: [`,
      `        .target(`,
      `            name: "${packageName}",`,
      `            path: "Sources/${packageName}"`,
      `        ),`,
      `        .testTarget(`,
      `            name: "${packageName}Tests",`,
      `            dependencies: ["${packageName}"]`,
      `        ),`,
      `    ]`,
      `)`,
    ].join('\n');

    const files = [
      `Sources/${packageName}/Models/${typeName}.swift`,
      `Sources/${packageName}/${typeName}Client.swift`,
      `Package.swift`,
    ];

    const packageId = `swift-sdk-${conceptName}-${Date.now()}`;

    await storage.put('package', packageId, {
      packageId,
      packageName,
      platforms: JSON.stringify(platforms),
      projection,
      config,
      files: JSON.stringify(files),
      modelsFile,
      clientFile,
      packageSwiftFile,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      package: packageId,
      files,
    };
  },
};
