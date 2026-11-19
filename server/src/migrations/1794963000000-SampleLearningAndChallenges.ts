import { MigrationInterface, QueryRunner } from 'typeorm';

export class SampleLearningAndChallenges1794963000000 implements MigrationInterface {
  name = 'SampleLearningAndChallenges1794963000000';
  async up(q: QueryRunner): Promise<void> {
    const lessons = [
      ['de1f1a2a-2145-4a6e-a101-000000000002', 'Variables and data types', 'A variable gives a name to a value. Java is statically typed: declare a type such as int, double, boolean, or String before the variable name.\n\nint age = 19;\ndouble score = 92.5;\nboolean enrolled = true;\nString name = "Ari";\n\nChoose a type that matches the data. Use meaningful names, and remember that Java statements end with a semicolon.'],
      ['de1f1a2a-2145-4a6e-a101-000000000003', 'Expressions and operators', 'Expressions combine values and operators to produce a result. Arithmetic operators include +, -, *, /, and %. Integer division drops the fractional part, so use a double when you need decimals.\n\nint total = 17 + 5;\nint remainder = 17 % 5;\ndouble average = (17 + 5) / 2.0;\n\nParentheses make the intended order clear. Compare values with ==, !=, <, and >.'],
      ['de1f1a2a-2145-4a6e-a101-000000000004', 'Make decisions with if and else', 'An if statement runs a block when its boolean condition is true. An optional else block runs otherwise.\n\nint temperature = 28;\nif (temperature > 30) {\n    System.out.println("Hot");\n} else {\n    System.out.println("Comfortable");\n}\n\nUse braces to make each branch easy to read. Combine conditions with && (and) or || (or).'],
      ['de1f1a2a-2145-4a6e-a101-000000000005', 'Repeat work with loops', 'A for loop is useful when you know how many times to repeat an action. A while loop repeats while a condition remains true.\n\nfor (int i = 1; i <= 5; i++) {\n    System.out.println(i);\n}\n\nCheck that each loop makes progress toward its stopping condition. A condition that never becomes false creates an infinite loop.'],
      ['de1f1a2a-2145-4a6e-a101-000000000006', 'Write reusable methods', 'A method names a reusable task. Its return type describes the value it gives back; use void when it returns nothing. Parameters let callers provide inputs.\n\nstatic int add(int left, int right) {\n    return left + right;\n}\n\nCall it with add(3, 4). Keep methods focused, name them with verbs, and return values instead of duplicating calculations.'],
    ] as const;
    for (let i = 0; i < lessons.length; i++) {
      const [id, title, content] = lessons[i]; const seq = i + 2; const versionId = `de1f1a2a-2145-4a6e-a101-00000000010${i}`;
      await q.query('INSERT IGNORE INTO `Lessons` (`id`,`module_id`,`title`,`sequence`,`status`) VALUES (?,?,?,?,?)', [id, '1ca87d83-e0be-4821-8d75-3a78602d9230', title, seq, 'published']);
      await q.query('INSERT IGNORE INTO `LessonVersions` (`id`,`lesson_id`,`version_number`,`content`,`status`,`published_at`) VALUES (?,?,1,?,?,CURRENT_TIMESTAMP(3))', [versionId, id, content, 'published']);
    }
    await q.query(`CREATE TABLE IF NOT EXISTS \`CodingChallenges\` (
      \`id\` char(36) NOT NULL, \`title\` varchar(180) NOT NULL, \`statement\` text NOT NULL,
      \`difficulty\` varchar(16) NOT NULL, \`starter_code\` longtext NOT NULL, \`sample_input\` text NOT NULL,
      \`sample_output\` text NOT NULL, \`sequence\` int NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'published',
      PRIMARY KEY (\`id\`), UNIQUE KEY \`UQ_CodingChallenges_sequence\` (\`sequence\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE IF NOT EXISTS \`ChallengeTestCases\` (
      \`id\` char(36) NOT NULL, \`challenge_id\` char(36) NOT NULL, \`input_data\` text NOT NULL,
      \`expected_output\` text NOT NULL, \`is_sample\` boolean NOT NULL DEFAULT false,
      PRIMARY KEY (\`id\`), KEY \`IDX_ChallengeTestCases_challenge\` (\`challenge_id\`),
      CONSTRAINT \`FK_ChallengeTestCases_challenge\` FOREIGN KEY (\`challenge_id\`) REFERENCES \`CodingChallenges\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    const challenges = [
      ['ea1f1a2a-2145-4a6e-a101-000000000001', 'Hello, Java!', 'Print exactly: Hello, Java! This warm-up checks basic console output.', 'beginner', 'public class Main {\n    public static void main(String[] args) {\n        // Print Hello, Java!\n    }\n}', '', 'Hello, Java!', 1],
      ['ea1f1a2a-2145-4a6e-a101-000000000002', 'Add two numbers', 'Read two whole numbers from standard input and print their sum.', 'beginner', 'import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Read two integers and print their sum\n    }\n}', '3 4', '7', 2],
      ['ea1f1a2a-2145-4a6e-a101-000000000003', 'Even or odd', 'Read one whole number. Print Even when divisible by 2, otherwise print Odd.', 'beginner', 'import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Decide whether the integer is even or odd\n    }\n}', '8', 'Even', 3],
      ['ea1f1a2a-2145-4a6e-a101-000000000004', 'Sum from 1 to N', 'Read a positive integer N and print the sum of every integer from 1 through N.', 'beginner', 'import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Add all integers from 1 through N\n    }\n}', '5', '15', 4],
      ['ea1f1a2a-2145-4a6e-a101-000000000005', 'Reverse a word', 'Read one word and print its characters in reverse order.', 'intermediate', 'import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Reverse the input word\n    }\n}', 'code', 'edoc', 5],
    ] as const;
    for (const row of challenges) await q.query('INSERT IGNORE INTO `CodingChallenges` (`id`,`title`,`statement`,`difficulty`,`starter_code`,`sample_input`,`sample_output`,`sequence`,`status`) VALUES (?,?,?,?,?,?,?,?,?)', [...row, 'published']);
    const tests = [
      ['ea1f1a2a-2145-4a6e-a101-000000000001', '', 'Hello, Java!'],
      ['ea1f1a2a-2145-4a6e-a101-000000000002', '3 4', '7'], ['ea1f1a2a-2145-4a6e-a101-000000000002', '-8 12', '4'],
      ['ea1f1a2a-2145-4a6e-a101-000000000003', '8', 'Even'], ['ea1f1a2a-2145-4a6e-a101-000000000003', '7', 'Odd'],
      ['ea1f1a2a-2145-4a6e-a101-000000000004', '5', '15'], ['ea1f1a2a-2145-4a6e-a101-000000000004', '10', '55'],
      ['ea1f1a2a-2145-4a6e-a101-000000000005', 'code', 'edoc'], ['ea1f1a2a-2145-4a6e-a101-000000000005', 'Java', 'avaJ'],
    ] as const;
    let n = 1;
    for (const [challengeId, input, output] of tests) await q.query('INSERT IGNORE INTO `ChallengeTestCases` (`id`,`challenge_id`,`input_data`,`expected_output`,`is_sample`) VALUES (?,?,?,?,?)', [`ea1f1a2a-2145-4a6e-a101-${String(n++).padStart(12, '0')}`, challengeId, input, output, true]);
    const hidden = [
      ['ea1f1a2a-2145-4a6e-a101-000000000002', '0 0', '0'],
      ['ea1f1a2a-2145-4a6e-a101-000000000003', '0', 'Even'],
      ['ea1f1a2a-2145-4a6e-a101-000000000004', '1', '1'],
      ['ea1f1a2a-2145-4a6e-a101-000000000005', 'level', 'level'],
    ] as const;
    n = 100;
    for (const [challengeId, input, output] of hidden) await q.query('INSERT IGNORE INTO `ChallengeTestCases` (`id`,`challenge_id`,`input_data`,`expected_output`,`is_sample`) VALUES (?,?,?,?,?)', [`ea1f1a2a-2145-4a6e-a101-${String(n++).padStart(12, '0')}`, challengeId, input, output, false]);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS `ChallengeTestCases`'); await q.query('DROP TABLE IF EXISTS `CodingChallenges`');
    await q.query("DELETE FROM `LessonVersions` WHERE `lesson_id` IN ('de1f1a2a-2145-4a6e-a101-000000000002','de1f1a2a-2145-4a6e-a101-000000000003','de1f1a2a-2145-4a6e-a101-000000000004','de1f1a2a-2145-4a6e-a101-000000000005','de1f1a2a-2145-4a6e-a101-000000000006')");
    await q.query("DELETE FROM `Lessons` WHERE `id` IN ('de1f1a2a-2145-4a6e-a101-000000000002','de1f1a2a-2145-4a6e-a101-000000000003','de1f1a2a-2145-4a6e-a101-000000000004','de1f1a2a-2145-4a6e-a101-000000000005','de1f1a2a-2145-4a6e-a101-000000000006')");
  }
}
