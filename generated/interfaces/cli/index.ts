// Auto-generated entrypoint for kit "conduit", target "cli"
import { Command } from 'commander';
import { ArticleCommand } from './Article/Article.command';
import { CommentCommand } from './Comment/Comment.command';
import { EchoCommand } from './Echo/Echo.command';
import { FavoriteCommand } from './Favorite/Favorite.command';
import { FollowCommand } from './Follow/Follow.command';
import { JWTCommand } from './JWT/JWT.command';
import { PasswordCommand } from './Password/Password.command';
import { ProfileCommand } from './Profile/Profile.command';
import { TagCommand } from './Tag/Tag.command';
import { UserCommand } from './User/User.command';

const program = new Command();

  program.addCommand(ArticleCommand);
  program.addCommand(CommentCommand);
  program.addCommand(EchoCommand);
  program.addCommand(FavoriteCommand);
  program.addCommand(FollowCommand);
  program.addCommand(JWTCommand);
  program.addCommand(PasswordCommand);
  program.addCommand(ProfileCommand);
  program.addCommand(TagCommand);
  program.addCommand(UserCommand);

export default program;
