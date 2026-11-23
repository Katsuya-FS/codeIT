import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserAccount } from '../identity/entities/user-account.entity';

@Injectable()
export class ClassroomsService {
  constructor(private readonly db: DataSource) {}

  async create(teacher: UserAccount, name: string) {
    await this.requireTeacher(teacher.id);
    const normalizedName = name.trim();
    if (normalizedName.length < 2) throw new BadRequestException('Classroom name must contain at least two characters.');
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomUUID(); const joinCode = randomBytes(9).toString('base64url');
      try {
        await this.db.query('INSERT INTO `Classrooms` (`id`,`teacher_user_id`,`join_code`,`name`) VALUES (?,?,?,?)', [id, teacher.id, joinCode, normalizedName]);
        return { id, name: normalizedName, joinCode, status: 'active' };
      } catch (error) { if (!this.isDuplicate(error)) throw error; }
    }
    throw new ConflictException('Could not create a unique classroom code. Please try again.');
  }

  async listForTeacher(teacher: UserAccount) {
    await this.requireTeacher(teacher.id);
    const classes = await this.db.query(`SELECT classroom.id, classroom.name, classroom.join_code AS joinCode,
      classroom.created_at AS createdAt,
      (SELECT COUNT(*) FROM ClassroomMemberships membership WHERE membership.classroom_id = classroom.id AND membership.status = 'active') AS activeMemberCount,
      (SELECT COUNT(*) FROM ClassroomJoinRequests request WHERE request.classroom_id = classroom.id AND request.status = 'pending') AS pendingRequestCount
      FROM Classrooms classroom WHERE classroom.teacher_user_id = ? AND classroom.status = 'active' ORDER BY classroom.created_at DESC`, [teacher.id]);
    for (const classroom of classes) classroom.activities = await this.getActivities(classroom.id);
    return classes;
  }

  async getForTeacher(teacher: UserAccount, classroomId: string) {
    const classroom = await this.ownedClassroom(teacher.id, classroomId);
    const [members, pendingRequests, activities] = await Promise.all([
      this.db.query(`SELECT membership.id, membership.student_user_id AS studentId, user.display_name AS displayName,
        user.email, membership.joined_at AS joinedAt FROM ClassroomMemberships membership
        INNER JOIN UserAccounts user ON user.id = membership.student_user_id
        WHERE membership.classroom_id = ? AND membership.status = 'active' ORDER BY membership.joined_at`, [classroomId]),
      this.db.query(`SELECT request.id, request.student_user_id AS studentId, user.display_name AS displayName,
        user.email, request.requested_at AS requestedAt FROM ClassroomJoinRequests request
        INNER JOIN UserAccounts user ON user.id = request.student_user_id
        WHERE request.classroom_id = ? AND request.status = 'pending' ORDER BY request.requested_at`, [classroomId]),
      this.getActivities(classroomId),
    ]);
    return { ...classroom, members, pendingRequests, activities };
  }

  async requestJoin(student: UserAccount, code: string) {
    this.requireStudentRole(student);
    await this.requireStudentProfile(student.id);
    return this.db.transaction(async (manager) => {
      const [classroom] = await manager.query('SELECT id, name FROM Classrooms WHERE join_code = ? AND status = ? FOR UPDATE', [code.trim(), 'active']);
      if (!classroom) throw new NotFoundException('Classroom not found. Check the code and try again.');
      const [membership] = await manager.query("SELECT id FROM ClassroomMemberships WHERE classroom_id = ? AND student_user_id = ? AND status = 'active' LIMIT 1", [classroom.id, student.id]);
      if (membership) throw new ConflictException('You are already a member of this classroom.');
      const [pending] = await manager.query("SELECT id FROM ClassroomJoinRequests WHERE classroom_id = ? AND student_user_id = ? AND status = 'pending' LIMIT 1", [classroom.id, student.id]);
      if (pending) return { id: pending.id, classroomId: classroom.id, classroomName: classroom.name, status: 'pending', alreadyRequested: true };
      const id = randomUUID();
      await manager.query('INSERT INTO ClassroomJoinRequests (`id`,`classroom_id`,`student_user_id`) VALUES (?,?,?)', [id, classroom.id, student.id]);
      return { id, classroomId: classroom.id, classroomName: classroom.name, status: 'pending', alreadyRequested: false };
    });
  }

  async studentDashboard(student: UserAccount) {
    this.requireStudentRole(student);
    await this.requireStudentProfile(student.id);
    const [memberships, requests] = await Promise.all([
      this.db.query(`SELECT classroom.id, classroom.name, teacher.id AS teacherId, teacher.display_name AS teacherName,
        membership.id AS membershipId, membership.joined_at AS joinedAt
        FROM ClassroomMemberships membership INNER JOIN Classrooms classroom ON classroom.id = membership.classroom_id
        INNER JOIN UserAccounts teacher ON teacher.id = classroom.teacher_user_id
        WHERE membership.student_user_id = ? AND membership.status = 'active' AND classroom.status = 'active'
        ORDER BY classroom.name`, [student.id]),
      this.db.query(`SELECT request.id, request.status, request.requested_at AS requestedAt, classroom.id AS classroomId,
        classroom.name AS classroomName FROM ClassroomJoinRequests request INNER JOIN Classrooms classroom ON classroom.id = request.classroom_id
        WHERE request.student_user_id = ? AND request.status = 'pending' ORDER BY request.requested_at DESC`, [student.id]),
    ]);
    for (const membership of memberships) membership.activities = await this.getActivities(membership.membershipId, true);
    return { memberships, requests };
  }

  async decideRequest(teacher: UserAccount, classroomId: string, requestId: string, approve: boolean) {
    await this.requireTeacher(teacher.id);
    return this.db.transaction(async (manager) => {
      const [classroom] = await manager.query('SELECT id FROM Classrooms WHERE id = ? AND teacher_user_id = ? AND status = ? FOR UPDATE', [classroomId, teacher.id, 'active']);
      if (!classroom) throw new NotFoundException('Classroom not found.');
      const [request] = await manager.query("SELECT id, student_user_id FROM ClassroomJoinRequests WHERE id = ? AND classroom_id = ? AND status = 'pending' FOR UPDATE", [requestId, classroomId]);
      if (!request) throw new ConflictException('This join request is no longer pending. Refresh the classroom and try again.');
      if (approve) {
        const [membership] = await manager.query("SELECT id FROM ClassroomMemberships WHERE classroom_id = ? AND student_user_id = ? AND status = 'active' LIMIT 1", [classroomId, request.student_user_id]);
        if (membership) throw new ConflictException('The student is already an active member.');
        await manager.query('INSERT INTO ClassroomMemberships (`id`,`classroom_id`,`student_user_id`) VALUES (?,?,?)', [randomUUID(), classroomId, request.student_user_id]);
      }
      const status = approve ? 'approved' : 'rejected';
      await manager.query('UPDATE ClassroomJoinRequests SET status = ?, decided_at = CURRENT_TIMESTAMP(3), decided_by_user_id = ? WHERE id = ?', [status, teacher.id, requestId]);
      return { id: requestId, classroomId, studentId: request.student_user_id, status };
    });
  }

  async leave(student: UserAccount, classroomId: string) {
    this.requireStudentRole(student);
    await this.requireStudentProfile(student.id);
    return this.db.transaction(async (manager) => {
      const [classroom] = await manager.query('SELECT id FROM Classrooms WHERE id = ? AND status = ? FOR UPDATE', [classroomId, 'active']);
      if (!classroom) throw new NotFoundException('Classroom not found.');
      const [membership] = await manager.query("SELECT id FROM ClassroomMemberships WHERE classroom_id = ? AND student_user_id = ? AND status = 'active' LIMIT 1 FOR UPDATE", [classroomId, student.id]);
      if (!membership) throw new NotFoundException('Active classroom membership not found.');
      await manager.query("UPDATE ClassroomMemberships SET status = 'left', left_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [membership.id]);
      return { classroomId, status: 'left' };
    });
  }

  async assignChallenge(teacher: UserAccount, classroomId: string, challengeId: string) {
    await this.ownedClassroom(teacher.id, classroomId);
    const [challenge] = await this.db.query("SELECT id FROM CodingChallenges WHERE id = ? AND status = 'published'", [challengeId]);
    if (!challenge) throw new NotFoundException('Published challenge not found.');
    const id = randomUUID();
    await this.db.query('INSERT INTO ClassroomActivities (`id`,`classroom_id`,`challenge_id`,`created_by_user_id`) VALUES (?,?,?,?)', [id, classroomId, challengeId, teacher.id]);
    const [activity] = await this.db.query('SELECT activity.id, activity.created_at AS createdAt, challenge.id AS challengeId, challenge.title, challenge.difficulty FROM ClassroomActivities activity INNER JOIN CodingChallenges challenge ON challenge.id = activity.challenge_id WHERE activity.id = ?', [id]);
    return activity;
  }

  private async getActivities(classroomId: string, byMembership = false) {
    const membershipJoin = byMembership ? 'INNER JOIN ClassroomMemberships membership ON membership.classroom_id = activity.classroom_id' : '';
    const clause = byMembership ? "membership.id = ? AND membership.status = 'active'" : 'activity.classroom_id = ?';
    const sql = `SELECT activity.id, activity.created_at AS assignedAt, challenge.id AS challengeId, challenge.title, challenge.difficulty
      FROM ClassroomActivities activity ${membershipJoin} INNER JOIN CodingChallenges challenge ON challenge.id = activity.challenge_id
      WHERE ${clause} ORDER BY activity.created_at DESC`;
    return this.db.query(sql, [classroomId]);
  }

  private async ownedClassroom(teacherId: string, classroomId: string) {
    const [classroom] = await this.db.query('SELECT id, name, join_code AS joinCode, status, created_at AS createdAt FROM Classrooms WHERE id = ? AND teacher_user_id = ? AND status = ?', [classroomId, teacherId, 'active']);
    if (!classroom) throw new NotFoundException('Classroom not found.');
    return classroom;
  }
  private async requireTeacher(userId: string) {
    const [teacher] = await this.db.query('SELECT user_id FROM TeacherProfiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!teacher) throw new ForbiddenException('An approved teacher profile is required.');
  }
  private async requireStudentProfile(userId: string) {
    const [student] = await this.db.query('SELECT user_id FROM StudentProfiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!student) throw new ForbiddenException('A student profile is required.');
  }
  private requireStudentRole(user: UserAccount) {
    if (user.roleName !== 'Student') throw new ForbiddenException('Only an active Student account may join or leave a classroom.');
  }
  private isDuplicate(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'ER_DUP_ENTRY'; }
}
